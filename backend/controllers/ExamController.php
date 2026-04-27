<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../middleware/Auth.php';

class ExamController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }
    
    /**
     * Calculate automatic exam status based on dates
     */
    private function calculateAutoStatus(string $startDate, string $endDate): string {
        $today = date('Y-m-d');
        
        if ($today < $startDate) {
            return 'আসন্ন'; // Upcoming
        } elseif ($today >= $startDate && $today <= $endDate) {
            return 'চলমান'; // Ongoing
        } else {
            return 'সম্পন্ন'; // Completed
        }
    }

    public function index(): void {
        Auth::require();
        
        $sessionId = $_GET['session_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        
        $where = ['1=1'];
        $params = [];
        
        // Filter by session - default to current session if not specified
        if ($sessionId) {
            $where[] = 'e.session_id = ?';
            $params[] = $sessionId;
        } else {
            // Default to current session
            $currentStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
            $currentSession = $currentStmt->fetch();
            if ($currentSession) {
                $where[] = 'e.session_id = ?';
                $params[] = $currentSession['id'];
            }
        }
        
        if ($classId) {
            $where[] = '(e.class_id = ? OR e.class_id IS NULL)';
            $params[] = $classId;
        }
        
        $sql = "SELECT e.*, COALESCE(c.name, 'সকল শ্রেণি') AS class_name 
                FROM exams e 
                LEFT JOIN classes c ON c.id = e.class_id 
                WHERE " . implode(' AND ', $where) . "
                ORDER BY e.start_date DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }
    
    /**
     * Get all exams (public access for result check page)
     * Filters by session_id and/or class_id if provided
     */
    public function all(): void {
        $sessionId = $_GET['session_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        
        $where = ['1=1'];
        $params = [];
        
        // Filter by session if provided
        if ($sessionId) {
            $where[] = 'e.session_id = ?';
            $params[] = $sessionId;
        }
        
        // Filter by class if provided (include exams for all classes)
        if ($classId) {
            $where[] = '(e.class_id = ? OR e.class_id IS NULL)';
            $params[] = $classId;
        }
        
        $sql = "SELECT e.id, e.name, e.class_id, e.start_date, e.end_date, e.session_id,
                       COALESCE(c.name, 'সকল শ্রেণি') AS class_name 
                FROM exams e 
                LEFT JOIN classes c ON c.id = e.class_id 
                WHERE " . implode(' AND ', $where) . "
                ORDER BY e.start_date DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    // create exam fees using per-class amounts from class_fees map { className: amount }
    // If no fees provided or amount is 0, fetch from fee_settings table
    private function createExamFeesPerClass(string $examName, array $classFees, ?int $createdBy, int $sessionId): void {
        // Get all classes
        $allClasses = $this->db->query("SELECT id, name FROM classes")->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($allClasses as $classRow) {
            $className = $classRow['name'];
            $classId = $classRow['id'];
            
            // Check if custom fee is provided for this class
            $amount = $classFees[$className] ?? null;
            
            // If no custom fee or amount is 0, fetch from fee_settings
            if ($amount === null || $amount <= 0) {
                $settingStmt = $this->db->prepare("SELECT exam FROM fee_settings WHERE class_id = ?");
                $settingStmt->execute([$classId]);
                $setting = $settingStmt->fetch();
                $amount = $setting ? (float)$setting['exam'] : 0;
            }
            
            // Skip if still no amount
            if ($amount <= 0) continue;
            
            // Get all active students in this class
            $students = $this->db->prepare("SELECT id FROM students WHERE class_id = ? AND status = 'সক্রিয়' AND session_id = ?");
            $students->execute([$classId, $sessionId]);
            
            foreach ($students->fetchAll() as $student) {
                // Use timestamp + random suffix for guaranteed uniqueness — no loop needed
                $feeId = 'FEE-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -6));
                
                $this->db->prepare("INSERT INTO fees (id, student_id, category, month, amount, paid, status, session_id) VALUES (?,?,?,?,?,?,?,?)")
                    ->execute([$feeId, $student['id'], 'পরীক্ষা ফি', $examName, (float)$amount, 0, 'বকেয়া', $sessionId]);
            }
        }
    }

    public function store(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['name','class','start_date','end_date'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");
        
        // Validate date order
        if ($body['start_date'] > $body['end_date']) {
            Response::error('Start date must be before or equal to end date');
        }

        $user = Auth::user();
        if (!$user) Response::error('Authentication required', 401);

        // Use session_id from request if provided, otherwise fall back to current session
        if (!empty($body['session_id'])) {
            $sessionId = (int)$body['session_id'];
        } else {
            $sessionStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
            $currentSession = $sessionStmt->fetch();
            if (!$currentSession) Response::error('No active session found. Please create and activate a session first.');
            $sessionId = (int)$currentSession['id'];
        }
        
        // Calculate automatic status based on dates
        $autoStatus = $this->calculateAutoStatus($body['start_date'], $body['end_date']);

        // Generate a unique exam ID using IdGenerator helper
        $newId = IdGenerator::generate($this->db, 'exams', 'EXM', false);

        if ($body['class'] === 'সকল শ্রেণি') {
            // One exam row for all classes (class_id = NULL)
            $this->db->prepare("INSERT INTO exams (id, name, class_id, start_date, end_date, status, is_annual, pass_mark_percent, session_id) VALUES (?,?,NULL,?,?,?,?,?,?)")
                ->execute([$newId, $body['name'], $body['start_date'], $body['end_date'], $autoStatus, (int)($body['is_annual'] ?? 0), (int)($body['pass_mark_percent'] ?? 33), $sessionId]);

            // Create exam fees per class if provided, otherwise use defaults from fee_settings
            $classFees = $body['class_fees'] ?? [];
            if (empty($body['skip_fees'])) {
                $this->createExamFeesPerClass($body['name'], $classFees, $user['id'] ?? null, $sessionId);
            }

            // Build fee note for notice - include both custom and default fees
            $feeNote = '';
            $allClasses = $this->db->query("SELECT c.id, c.name, fs.exam FROM classes c LEFT JOIN fee_settings fs ON c.id = fs.class_id")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($allClasses as $cls) {
                $amount = $classFees[$cls['name']] ?? ($cls['exam'] ?? 0);
                if ($amount > 0) {
                    $feeNote .= $cls['name'] . ": ৳$amount, ";
                }
            }
            
            $noticeTitle   = $body['name'] . ' — সকল শ্রেণির পরীক্ষার সময়সূচি';
            $noticeContent = $body['name'] . ' পরীক্ষা ' . $body['start_date'] . ' তারিখ থেকে শুরু হয়ে ' . $body['end_date'] . ' তারিখে শেষ হবে।'
                . ($feeNote ? ' পরীক্ষা ফি: ' . rtrim($feeNote, ', ') . '।' : '')
                . ' সকল শ্রেণির শিক্ষার্থীদের যথাসময়ে প্রস্তুতি নিতে বলা হচ্ছে।';
            
            try {
                $this->db->prepare("INSERT INTO notices (title, content, category, is_important, status, created_by) VALUES (?,?,?,?,?,?)")
                    ->execute([$noticeTitle, $noticeContent, 'পরীক্ষা', 1, 'draft', $user['id']]);
            } catch (Exception $e) {
                error_log("Failed to create notice for exam: " . $e->getMessage());
            }

            Response::success(['id' => $newId], 'Exam created for all classes', 201);
        }

        // Single class exam
        $s = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $s->execute([$body['class']]);
        $classRow = $s->fetch();
        if (!$classRow) Response::error('Invalid class');

        $this->db->prepare("INSERT INTO exams (id, name, class_id, start_date, end_date, status, is_annual, pass_mark_percent, session_id) VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([$newId, $body['name'], $classRow['id'], $body['start_date'], $body['end_date'], $autoStatus, (int)($body['is_annual'] ?? 0), (int)($body['pass_mark_percent'] ?? 33), $sessionId]);

        // Use custom fee if provided, otherwise use default from fee_settings
        $classFees = $body['class_fees'] ?? [$body['class'] => ($body['exam_fee'] ?? 0)];
        if (empty($body['skip_fees'])) {
            $this->createExamFeesPerClass($body['name'], $classFees, $user['id'] ?? null, $sessionId);
        }

        // Get the actual fee amount used (custom or default)
        $feeAmt = $classFees[$body['class']] ?? 0;
        if ($feeAmt <= 0) {
            // Fetch from fee_settings if not provided
            $settingStmt = $this->db->prepare("SELECT exam FROM fee_settings WHERE class_id = ?");
            $settingStmt->execute([$classRow['id']]);
            $setting = $settingStmt->fetch();
            $feeAmt = $setting ? (float)$setting['exam'] : 0;
        }
        
        $noticeTitle   = $body['name'] . ' — পরীক্ষার সময়সূচি';
        $noticeContent = $body['name'] . ' পরীক্ষা ' . $body['start_date'] . ' তারিখ থেকে শুরু হয়ে ' . $body['end_date'] . ' তারিখে শেষ হবে। শ্রেণি: ' . $body['class'] . '।'
            . ($feeAmt > 0 ? ' পরীক্ষা ফি: ৳' . $feeAmt . '।' : '')
            . ' সকল শিক্ষার্থীদের যথাসময়ে প্রস্তুতি নিতে বলা হচ্ছে।';
        
        try {
            $this->db->prepare("INSERT INTO notices (title, content, category, is_important, status, created_by) VALUES (?,?,?,?,?,?)")
                ->execute([$noticeTitle, $noticeContent, 'পরীক্ষা', 1, 'draft', $user['id']]);
        } catch (Exception $e) {
            error_log("Failed to create notice for exam: " . $e->getMessage());
        }

        Response::success(['id' => $newId], 'Exam created', 201);
    }

    public function update(string $id): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $fields = []; $params = [];
        foreach (['name','start_date','end_date','status'] as $f)
            if (isset($body[$f])) { $fields[] = "$f = ?"; $params[] = $body[$f]; }
        if (isset($body['is_annual']))         { $fields[] = "is_annual = ?";         $params[] = (int)$body['is_annual']; }
        if (isset($body['pass_mark_percent'])) { $fields[] = "pass_mark_percent = ?"; $params[] = (int)$body['pass_mark_percent']; }
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id;
        $this->db->prepare("UPDATE exams SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        Response::success(null, 'Updated');
    }

    public function destroy(string $id): void {
        Auth::requireRole('admin');
        // Delete dependent records first to avoid FK constraint violations
        $this->db->prepare('DELETE FROM promotions WHERE exam_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM results WHERE exam_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM exam_routine_legacy WHERE exam_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM exams WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }
}
