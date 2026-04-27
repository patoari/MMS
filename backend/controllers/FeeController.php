<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../middleware/Auth.php';

class FeeController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $caller = Auth::require();
        if (!$caller) Response::error('Authentication required', 401);
        if (!in_array($caller['role'], ['admin', 'accountant'])) Response::error('Forbidden', 403);

        $category  = $_GET['category']   ?? '';
        $status    = $_GET['status']     ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $month     = $_GET['month']      ?? '';
        $studentId = $_GET['student_id'] ?? '';
        $search    = trim($_GET['search'] ?? '');

        // ── Student-search mode: return all matching students with fee summary ──
        // When a free-text search is provided, we do a student-first LEFT JOIN so
        // students with zero fee records still appear in the results.
        if ($search !== '') {
            $studentWhere = ['s.deleted_at IS NULL'];
            $studentParams = [];

            // Match by student ID or name
            $studentWhere[] = '(s.id LIKE ? OR s.name LIKE ? OR s.name_bn LIKE ?)';
            $like = '%' . $search . '%';
            $studentParams[] = $like;
            $studentParams[] = $like;
            $studentParams[] = $like;

            // class_teacher restriction
            if ($caller['role'] === 'class_teacher') {
                $uStmt = $this->db->prepare('SELECT class_id FROM users WHERE id = ?');
                $uStmt->execute([$caller['id']]);
                $uRow = $uStmt->fetch();
                if (!$uRow || !$uRow['class_id']) Response::error('No class assigned', 403);
                $studentWhere[] = 's.class_id = ?';
                $studentParams[] = $uRow['class_id'];
            }

            $whereClause = implode(' AND ', $studentWhere);

            // Get matching students
            $stuStmt = $this->db->prepare("
                SELECT s.id, s.name, s.name_bn, c.name AS class, s.class_id
                FROM students s
                JOIN classes c ON c.id = s.class_id
                WHERE $whereClause
                ORDER BY s.id
            ");
            $stuStmt->execute($studentParams);
            $students = $stuStmt->fetchAll();

            if (empty($students)) {
                Response::success([]);
                return;
            }

            // For each student, get their fee records
            $results = [];
            foreach ($students as $stu) {
                $feeWhere = ['f.student_id = ?'];
                $feeParams = [$stu['id']];

                if ($category) { $feeWhere[] = 'f.category = ?'; $feeParams[] = $category; }
                if ($status)   { $feeWhere[] = 'f.status = ?';   $feeParams[] = $status; }
                if ($month)    { $feeWhere[] = 'f.month = ?';    $feeParams[] = $month; }

                if ($sessionId) {
                    $feeWhere[] = 'f.session_id = ?';
                    $feeParams[] = $sessionId;
                } else {
                    $currentStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
                    $currentSession = $currentStmt->fetch();
                    if ($currentSession) {
                        $feeWhere[] = 'f.session_id = ?';
                        $feeParams[] = $currentSession['id'];
                    }
                }

                $feeStmt = $this->db->prepare("
                    SELECT f.*,
                           GREATEST(f.amount - f.paid, 0) AS due,
                           ? AS student_name,
                           ? AS class
                    FROM fees f
                    WHERE " . implode(' AND ', $feeWhere) . "
                    ORDER BY f.created_at DESC
                ");
                array_unshift($feeParams, $stu['name'], $stu['class']);
                $feeStmt->execute($feeParams);
                $feeRows = $feeStmt->fetchAll();

                if (!empty($feeRows)) {
                    foreach ($feeRows as $row) {
                        $results[] = $row;
                    }
                } else {
                    // Student has no fee records — return a placeholder row
                    $results[] = [
                        'id'           => null,
                        'student_id'   => $stu['id'],
                        'student_name' => $stu['name'],
                        'class'        => $stu['class'],
                        'category'     => '—',
                        'month'        => '—',
                        'amount'       => 0,
                        'paid'         => 0,
                        'due'          => 0,
                        'status'       => 'কোনো ফি নেই',
                        'session_id'   => null,
                        'created_at'   => null,
                    ];
                }
            }

            Response::success($results);
            return;
        }

        // ── Default mode: fee-first query (no search text) ──
        $where = ['s.deleted_at IS NULL']; $params = [];
        if ($studentId) { $where[] = 'f.student_id = ?'; $params[] = $studentId; }
        if ($category)  { $where[] = 'f.category = ?';   $params[] = $category; }
        if ($status)    { $where[] = 'f.status = ?';     $params[] = $status; }
        if ($month)     { $where[] = 'f.month = ?';      $params[] = $month; }

        // Session filter — skip when filtering by student or month
        if (!$studentId && !$month) {
            if ($sessionId) {
                $where[] = 'f.session_id = ?';
                $params[] = $sessionId;
            } else {
                $currentStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
                $currentSession = $currentStmt->fetch();
                if ($currentSession) {
                    $where[] = 'f.session_id = ?';
                    $params[] = $currentSession['id'];
                }
            }
        }

        $sql = "SELECT f.*, GREATEST(f.amount - f.paid, 0) AS due, s.name AS student_name, c.name AS class
                FROM fees f
                JOIN students s ON s.id = f.student_id
                JOIN classes  c ON c.id = s.class_id
                WHERE " . implode(' AND ', $where) . " ORDER BY f.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['category','month','amount'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");

        // Validate amount is positive
        if ((float)$body['amount'] <= 0) Response::error('Amount must be greater than 0');

        // Get current session
        $sessionStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
        $currentSession = $sessionStmt->fetch();
        if (!$currentSession) Response::error('No active session found. Please create and activate a session first.');
        $sessionId = $currentSession['id'];

        // Generate unique ID using timestamp + random suffix
        $newId = 'FEE-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -6));

        $this->db->prepare("INSERT INTO fees (id, student_id, category, month, amount, paid, status, session_id)
                            VALUES (?, ?, ?, ?, ?, 0, 'বকেয়া', ?)")
            ->execute([$newId, $body['student_id'] ?? null, $body['category'], $body['month'], $body['amount'], $sessionId]);
        Response::success(['id' => $newId], 'Fee record created', 201);
    }

    public function collect(string $feeId): void {
        $caller = Auth::require();
        if (!$caller) Response::error('Authentication required', 401);
        if (!in_array($caller['role'], ['admin', 'accountant'])) Response::error('Forbidden', 403);
        
        $body   = json_decode(file_get_contents('php://input'), true);
        $amount = (float)($body['amount'] ?? 0);
        if ($amount <= 0) Response::error('Amount must be positive');
        
        // Get payment date from request, default to today
        $paymentDate = $body['payment_date'] ?? date('Y-m-d');

        $stmt = $this->db->prepare('SELECT f.*, s.class_id FROM fees f JOIN students s ON s.id = f.student_id WHERE f.id = ?');
        $stmt->execute([$feeId]);
        $fee = $stmt->fetch();
        if (!$fee) Response::error('Fee not found', 404);

        $newPaid = $fee['paid'] + $amount;
        $newDue  = $fee['amount'] - $newPaid;
        $status  = $newDue > 0 ? 'আংশিক' : ($newDue == 0 ? 'পরিশোধিত' : 'অগ্রিম');

        $this->db->prepare("UPDATE fees SET paid = ?, status = ?, paid_date = ? WHERE id = ?")
            ->execute([$newPaid, $status, $paymentDate, $feeId]);

        $user = Auth::user();
        // Check if transaction_date column exists in fee_transactions table
        try {
            $checkCol = $this->db->query("SHOW COLUMNS FROM fee_transactions LIKE 'transaction_date'")->fetch();
            $hasTransactionDate = $checkCol !== false;
        } catch (Exception $e) {
            error_log("Error checking transaction_date column: " . $e->getMessage());
            $hasTransactionDate = false;
        }
        
        if ($hasTransactionDate) {
            $this->db->prepare("INSERT INTO fee_transactions (fee_id, amount, collected_by, transaction_date) VALUES (?, ?, ?, ?)")
                ->execute([$feeId, $amount, $user['id'] ?? null, $paymentDate]);
        } else {
            $this->db->prepare("INSERT INTO fee_transactions (fee_id, amount, collected_by) VALUES (?, ?, ?)")
                ->execute([$feeId, $amount, $user['id'] ?? null]);
        }

        Response::success(['status' => $status, 'paid' => $newPaid, 'due' => $newDue, 'payment_date' => $paymentDate]);
    }

    public function update(string $feeId): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($body['amount'])) Response::error('Amount is required');
        
        $newAmount = (float)$body['amount'];
        if ($newAmount < 0) Response::error('Amount cannot be negative');
        
        // Get current fee
        $stmt = $this->db->prepare('SELECT * FROM fees WHERE id = ?');
        $stmt->execute([$feeId]);
        $fee = $stmt->fetch();
        if (!$fee) Response::error('Fee not found', 404);
        
        // Calculate new status based on paid amount and new total amount
        $paid = (float)$fee['paid'];
        $newDue = $newAmount - $paid;
        
        if ($newAmount == 0) {
            $status = 'পরিশোধিত'; // Fully waived
        } elseif ($newDue <= 0) {
            $status = $paid > $newAmount ? 'অগ্রিম' : 'পরিশোধিত';
        } elseif ($paid > 0) {
            $status = 'আংশিক';
        } else {
            $status = 'বকেয়া';
        }
        
        // Check if waiver_reason column exists
        try {
            $checkCol = $this->db->query("SHOW COLUMNS FROM fees LIKE 'waiver_reason'")->fetch();
            $hasWaiverColumn = $checkCol !== false;
        } catch (Exception $e) {
            error_log("Error checking waiver_reason column: " . $e->getMessage());
            $hasWaiverColumn = false;
        }
        
        // Update fee - with or without waiver_reason depending on column existence
        if ($hasWaiverColumn) {
            $updateStmt = $this->db->prepare("
                UPDATE fees 
                SET amount = ?, status = ?, waiver_reason = ?
                WHERE id = ?
            ");
            $updateStmt->execute([
                $newAmount,
                $status,
                $body['waiver_reason'] ?? null,
                $feeId
            ]);
        } else {
            $updateStmt = $this->db->prepare("
                UPDATE fees 
                SET amount = ?, status = ?
                WHERE id = ?
            ");
            $updateStmt->execute([
                $newAmount,
                $status,
                $feeId
            ]);
        }
        
        Response::success([
            'id' => $feeId,
            'amount' => $newAmount,
            'paid' => $paid,
            'due' => max(0, $newDue),
            'status' => $status
        ], 'Fee updated successfully');
    }

    public function byStudent(string $studentId): void {
        Auth::require();
        $stmt = $this->db->prepare("SELECT * FROM fees WHERE student_id = ? ORDER BY created_at DESC");
        $stmt->execute([$studentId]);
        Response::success($stmt->fetchAll());
    }

    /**
     * Returns active admit cards for the logged-in student.
     * An admit card is active when:
     *   - The student has paid the exam fee for that exam
     *   - The exam status is NOT 'সম্পন্ন' (completed)
     */
    public function myAdmitCards(): void {
        $user = Auth::requireRole('student');

        $db = $this->db;

        // Get student record
        $stuStmt = $db->prepare('SELECT s.*, c.name AS class FROM students s JOIN classes c ON c.id = s.class_id WHERE s.user_id = ?');
        $stuStmt->execute([$user['id']]);
        $student = $stuStmt->fetch();
        if (!$student) Response::error('Student not found', 404);

        // Transform photo URL
        require_once __DIR__ . '/../helpers/FileUpload.php';
        $student['photo'] = FileUpload::transformPhotoUrl($student['photo']);

        $today = date('Y-m-d');

        // Find exam fees that are paid (status = 'পরিশোধিত' or 'অগ্রিম')
        // and whose linked exam is not yet completed
        $stmt = $db->prepare("
            SELECT
                f.id        AS fee_id,
                f.month     AS exam_name,
                f.paid,
                f.amount,
                e.id        AS exam_id,
                e.start_date,
                e.end_date,
                e.status    AS manual_status,
                CASE
                    WHEN ? < e.start_date THEN 'আসন্ন'
                    WHEN ? >= e.start_date AND ? <= e.end_date THEN 'চলমান'
                    ELSE 'সম্পন্ন'
                END AS auto_status
            FROM fees f
            LEFT JOIN exams e ON e.name = f.month
                AND (e.class_id = ? OR e.class_id IS NULL)
            WHERE f.student_id = ?
              AND f.category   = 'পরীক্ষা ফি'
              AND f.status IN ('পরিশোধিত', 'অগ্রিম')
        ");
        $stmt->execute([$today, $today, $today, $student['class_id'], $student['id']]);
        $rows = $stmt->fetchAll();

        $admitCards = [];
        foreach ($rows as $row) {
            // Determine effective status
            $effectiveStatus = $row['manual_status'] ?: $row['auto_status'];

            // Skip if exam is completed
            if ($effectiveStatus === 'সম্পন্ন') continue;

            $admitCards[] = [
                'examName'    => $row['exam_name'],
                'examId'      => $row['exam_id'],
                'startDate'   => $row['start_date'],
                'endDate'     => $row['end_date'],
                'status'      => $effectiveStatus,
                'studentId'   => $student['id'],
                'studentName' => $student['name'],
                'class'       => $student['class'],
                'roll'        => $student['roll'],
                'section'     => $student['section'],
                'photo'       => $student['photo'],
            ];
        }

        Response::success($admitCards);
    }

    public function myFees(): void {
        $user = Auth::requireRole('student');
        $s = $this->db->prepare('SELECT id FROM students WHERE user_id = ?');
        $s->execute([$user['id']]);
        $row = $s->fetch();
        if (!$row) Response::error('Student not found', 404);
        $stmt = $this->db->prepare("SELECT * FROM fees WHERE student_id = ? ORDER BY created_at DESC");
        $stmt->execute([$row['id']]);
        Response::success($stmt->fetchAll());
    }

    public function summary(): void {
        Auth::requireRole('admin', 'accountant');
        $row = $this->db->query("
            SELECT 
                SUM(f.paid) AS total_collected, 
                SUM(GREATEST(f.amount - f.paid, 0)) AS total_due, 
                COUNT(*) AS total_records 
            FROM fees f
            JOIN students s ON s.id = f.student_id
            WHERE s.deleted_at IS NULL
        ")->fetch();
        Response::success($row);
    }

    public function getSettings(): void {
        Auth::require();
        // Return all classes with their fee settings (LEFT JOIN so classes without settings also appear)
        $stmt = $this->db->query("
            SELECT c.id AS class_id, c.name AS class,
                   COALESCE(fs.admission, 0) AS admission,
                   COALESCE(fs.session,   0) AS session,
                   COALESCE(fs.monthly,   0) AS monthly,
                   COALESCE(fs.exam,      0) AS exam
            FROM classes c
            LEFT JOIN fee_settings fs ON fs.class_id = c.id
            ORDER BY c.id
        ");
        $rows = $stmt->fetchAll();

        // Auto-create missing fee_settings rows so they can be updated later
        foreach ($rows as $row) {
            if ($row['admission'] == 0 && $row['session'] == 0 && $row['monthly'] == 0 && $row['exam'] == 0) {
                // Check if row exists
                $exists = $this->db->prepare("SELECT id FROM fee_settings WHERE class_id = ?");
                $exists->execute([$row['class_id']]);
                if (!$exists->fetch()) {
                    $this->db->prepare(
                        "INSERT INTO fee_settings (class_id, admission, session, monthly, exam) VALUES (?, 0, 0, 0, 0)"
                    )->execute([$row['class_id']]);
                }
            }
        }

        Response::success($rows);
    }

    public function updateSettings(int $classId): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        
        $admission = max(0, (float)($body['admission'] ?? 0));
        $session = max(0, (float)($body['session'] ?? 0));
        $monthly = max(0, (float)($body['monthly'] ?? 0));
        $exam = max(0, (float)($body['exam'] ?? 0));

        $this->db->prepare("UPDATE fee_settings SET admission=?, session=?, monthly=?, exam=? WHERE class_id=?")
            ->execute([$admission, $session, $monthly, $exam, $classId]);
        Response::success(null, 'Fee settings updated');
    }

    /**
     * Returns per-student cumulative due (unpaid) amounts across all fee records
     * up to and including the selected billing month, plus how much due was
     * collected (paid) during the selected calendar month for prior-month fees.
     *
     * GET /fees/due-collections?payment_month=2026-04&billing_month=এপ্রিল%202026
     *
     * Returns: {
     *   due_balance:  { student_id: total_unpaid_across_all_months },
     *   due_paid_this_month: { student_id: amount_paid_this_calendar_month_for_prior_fees }
     * }
     */
    public function dueCollections(): void {
        Auth::requireRole('admin', 'accountant');
        $paymentMonth = $_GET['payment_month'] ?? date('Y-m'); // e.g. 2026-04
        $billingMonth = $_GET['billing_month'] ?? '';           // e.g. জানুয়ারি 2026 (with English year)

        // 1. Cumulative unpaid balance per student (all fees, any month, not fully paid)
        $dueStmt = $this->db->prepare("
            SELECT f.student_id,
                   SUM(GREATEST(f.amount - f.paid, 0)) AS total_due
            FROM fees f
            JOIN students s ON s.id = f.student_id
            WHERE s.deleted_at IS NULL
              AND f.status != 'পরিশোধিত'
            GROUP BY f.student_id
        ");
        $dueStmt->execute();
        $dueRows = $dueStmt->fetchAll(PDO::FETCH_ASSOC);
        $dueBalance = [];
        foreach ($dueRows as $r) {
            $dueBalance[$r['student_id']] = (float)$r['total_due'];
        }

        // 2. Amount paid THIS calendar month for fees from OTHER (prior) months
        // Use transaction_date if available, otherwise fall back to collected_at
        $paidStmt = $this->db->prepare("
            SELECT f.student_id, SUM(ft.amount) AS due_collected
            FROM fee_transactions ft
            JOIN fees f ON f.id = ft.fee_id
            JOIN students s ON s.id = f.student_id
            WHERE DATE_FORMAT(COALESCE(ft.transaction_date, DATE(ft.collected_at)), '%Y-%m') = ?
              AND f.month != ?
              AND s.deleted_at IS NULL
            GROUP BY f.student_id
        ");
        $paidStmt->execute([$paymentMonth, $billingMonth]);
        $paidRows = $paidStmt->fetchAll(PDO::FETCH_ASSOC);
        $duePaidThisMonth = [];
        foreach ($paidRows as $r) {
            $duePaidThisMonth[$r['student_id']] = (float)$r['due_collected'];
        }

        Response::success([
            'due_balance'        => $dueBalance,
            'due_paid_this_month' => $duePaidThisMonth,
        ]);
    }

    public function generateMonthly(): void {
        Auth::requireRole('admin');
        $body  = json_decode(file_get_contents('php://input'), true);
        $month = trim($body['month'] ?? '');
        if (!$month) Response::error('Month is required');

        // Get current session
        $sessionStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
        $currentSession = $sessionStmt->fetch();
        if (!$currentSession) Response::error('No active session found');
        $sessionId = $currentSession['id'];

        // Get all active students with their class fee setting
        $stmt = $this->db->query("
            SELECT s.id AS student_id, s.class_id, fs.monthly AS amount
            FROM students s
            JOIN fee_settings fs ON fs.class_id = s.class_id
            WHERE s.deleted_at IS NULL AND fs.monthly > 0
        ");
        $students = $stmt->fetchAll();

        if (empty($students)) Response::error('No students found or no monthly fee configured');

        $created = 0; $skipped = 0;
        foreach ($students as $row) {
            // Skip if fee already exists for this student+month
            $check = $this->db->prepare(
                "SELECT id FROM fees WHERE student_id = ? AND category = 'মাসিক ফি' AND month = ? AND session_id = ?"
            );
            $check->execute([$row['student_id'], $month, $sessionId]);
            if ($check->fetch()) { $skipped++; continue; }

            // Use timestamp + random suffix for guaranteed uniqueness — no loop needed
            $newId = 'FEE-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -6));

            $this->db->prepare(
                "INSERT INTO fees (id, student_id, category, month, amount, paid, status, session_id)
                 VALUES (?, ?, 'মাসিক ফি', ?, ?, 0, 'বকেয়া', ?)"
            )->execute([$newId, $row['student_id'], $month, $row['amount'], $sessionId]);
            $created++;
        }

        Response::success(
            ['created' => $created, 'skipped' => $skipped],
            "$created টি মাসিক ফি তৈরি হয়েছে, $skipped টি আগে থেকেই ছিল"
        );
    }
}
