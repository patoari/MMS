<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/ValidationHelper.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/HolidayController.php';

class AttendanceController {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::connect();
    }

    // GET /attendance?class=ক্লাস ৮&date=2026-04-19&session_id=1
    public function index(): void {
        $user = Auth::user();
        if (!$user) Response::error('Authentication required', 401);
        
        $className = $_GET['class'] ?? '';
        $date = $_GET['date'] ?? date('Y-m-d');
        $sessionId = $_GET['session_id'] ?? null;
        
        if (!$className) {
            Response::error('class parameter required');
        }

        // Get current session if not provided
        if (!$sessionId) {
            $sessionStmt = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1');
            $currentSession = $sessionStmt->fetch();
            if (!$currentSession) {
                Response::error('No active session found');
            }
            $sessionId = $currentSession['id'];
        }

        // Get class_id
        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) {
            Response::error('Class not found', 404);
        }
        $classId = $clsRow['id'];

        // Get attendance records for the date
        $stmt = $this->db->prepare(
            'SELECT a.student_id, a.status, a.note, a.session_id, a.month, a.year
             FROM attendance a
             WHERE a.session_id = ? AND a.class_id = ? AND a.date = ?'
        );
        $stmt->execute([$sessionId, $classId, $date]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $attendanceMap = [];
        foreach ($records as $record) {
            $attendanceMap[$record['student_id']] = [
                'status' => $record['status'],
                'note' => $record['note'],
                'session_id' => $record['session_id'],
                'month' => $record['month'],
                'year' => $record['year']
            ];
        }

        Response::success([
            'attendance' => $attendanceMap,
            'session_id' => $sessionId,
            'date' => $date,
            'month' => date('Y-m', strtotime($date)),
            'year' => date('Y', strtotime($date))
        ]);
    }

    // POST /attendance { class, date, session_id, attendance: { studentId: { status, note } } }
    public function store(): void {
        $user = Auth::user();
        
        // Only class teachers and admins can take attendance
        if (!in_array($user['role'], ['admin', 'class_teacher'])) {
            Response::error('Unauthorized', 403);
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $className = $body['class'] ?? '';
        $date = $body['date'] ?? date('Y-m-d');
        $sessionId = $body['session_id'] ?? null;
        $attendance = $body['attendance'] ?? [];

        if (!$className) {
            Response::error('class required');
        }
        
        // Validate date format
        if (!ValidationHelper::isValidDate($date)) {
            Response::error('Invalid date format. Use Y-m-d format.');
        }

        // Block saving attendance on holidays
        if (HolidayController::isHoliday($this->db, $date)) {
            Response::error('এই তারিখটি ছুটির দিন। ছুটির দিনে হাজিরা নেওয়া যাবে না।', 422);
        }

        // Get current session if not provided
        if (!$sessionId) {
            $sessionStmt = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1');
            $currentSession = $sessionStmt->fetch();
            if (!$currentSession) {
                Response::error('No active session found');
            }
            $sessionId = $currentSession['id'];
        }

        // Verify session exists
        $sessionCheck = $this->db->prepare('SELECT id FROM academic_sessions WHERE id = ?');
        $sessionCheck->execute([$sessionId]);
        if (!$sessionCheck->fetch()) {
            Response::error('Invalid session', 404);
        }

        // Get class_id
        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) {
            Response::error('Class not found', 404);
        }
        $classId = $clsRow['id'];

        // If class teacher, verify they are assigned to this class
        if ($user['role'] === 'class_teacher') {
            $teacherStmt = $this->db->prepare(
                'SELECT c.name AS class FROM teachers t LEFT JOIN classes c ON c.id = t.class_id WHERE t.user_id = ?'
            );
            $teacherStmt->execute([$user['id']]);
            $teacher = $teacherStmt->fetch();

            // Also check users.class_id as fallback (for class_teachers without a teachers record)
            if (!$teacher || !$teacher['class']) {
                $uStmt = $this->db->prepare('SELECT c.name AS class FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?');
                $uStmt->execute([$user['id']]);
                $teacher = $uStmt->fetch();
            }

            if (!$teacher || $teacher['class'] !== $className) {
                Response::error('You are not assigned to this class', 403);
            }
        }

        // Extract month and year from date
        $month = date('Y-m', strtotime($date));
        $year = date('Y', strtotime($date));

        $this->db->beginTransaction();

        try {
            $stmt = $this->db->prepare(
                'INSERT INTO attendance (session_id, class_id, student_id, date, month, year, status, note, taken_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    status = VALUES(status), 
                    note = VALUES(note), 
                    taken_by = VALUES(taken_by),
                    updated_at = CURRENT_TIMESTAMP'
            );

            foreach ($attendance as $studentId => $data) {
                $status = $data['status'] ?? 'present';
                $note = $data['note'] ?? null;
                $stmt->execute([$sessionId, $classId, $studentId, $date, $month, $year, $status, $note, $user['id']]);
            }

            $this->db->commit();
            Response::success([
                'message' => 'Attendance saved successfully',
                'session_id' => $sessionId,
                'date' => $date,
                'month' => $month,
                'year' => $year,
                'records_saved' => count($attendance)
            ]);
        } catch (Exception $e) {
            $this->db->rollBack();
            Response::error('Failed to save attendance: ' . $e->getMessage());
        }
    }

    // GET /attendance/report?class=ক্লাস ৮&month=2026-04&session_id=1
    public function report(): void {
        $className = $_GET['class'] ?? '';
        $month = $_GET['month'] ?? date('Y-m');
        $sessionId = $_GET['session_id'] ?? null;
        
        if (!$className) {
            Response::error('class parameter required');
        }

        // Get current session if not provided
        if (!$sessionId) {
            $sessionStmt = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1');
            $currentSession = $sessionStmt->fetch();
            if ($currentSession) {
                $sessionId = $currentSession['id'];
            }
        }

        // Get class_id
        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) {
            Response::error('Class not found', 404);
        }
        $classId = $clsRow['id'];

        // Get all holiday dates in this month (declared + Fridays)
        $holidayDates = HolidayController::getHolidayDatesInMonth($this->db, $month);
        $holidayPlaceholders = count($holidayDates) > 0
            ? implode(',', array_fill(0, count($holidayDates), '?'))
            : "'__none__'";

        // Get attendance summary for the month, excluding holidays + always exclude Fridays
        $excludeClause = "AND DAYOFWEEK(a.date) != 6";
        if (count($holidayDates) > 0) {
            $excludeClause .= " AND a.date NOT IN ($holidayPlaceholders)";
        }

        $sql = "SELECT 
                s.id, s.name, s.roll,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
                COUNT(CASE WHEN a.status = 'absent'  THEN 1 END) as absent_days,
                COUNT(CASE WHEN a.status = 'late'    THEN 1 END) as late_days,
                COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_days,
                COUNT(a.id) as total_days,
                ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END) / NULLIF(COUNT(a.id), 0)) * 100, 2) as attendance_percentage
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id 
                AND a.session_id = ? 
                AND a.month = ?
                $excludeClause
             WHERE s.class_id = ? AND s.session_id = ? AND s.deleted_at IS NULL
             GROUP BY s.id
             ORDER BY s.roll";

        $params = [$sessionId, $month];
        if (count($holidayDates) > 0) $params = array_merge($params, $holidayDates);
        $params = array_merge($params, [$classId, $sessionId]);

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $report = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ── Working days = days passed so far (up to today) - Fridays - declared holidays ──
        [$monthYear, $monthNum] = explode('-', $month);
        $daysInMonth = (int)date('t', mktime(0, 0, 0, (int)$monthNum, 1, (int)$monthYear));
        // Cap at today if the month is current or future
        $today = date('Y-m-d');
        $todayMonthPrefix = date('Y-m');
        if ($month >= $todayMonthPrefix) {
            $countUpTo = ($month === $todayMonthPrefix) ? (int)date('j') : 0;
        } else {
            $countUpTo = $daysInMonth; // past month — count all days
        }
        $workingDays = 0;
        for ($d = 1; $d <= $countUpTo; $d++) {
            $ds = sprintf('%04d-%02d-%02d', $monthYear, $monthNum, $d);
            if (date('N', mktime(0, 0, 0, (int)$monthNum, $d, (int)$monthYear)) == 5) continue; // Friday
            if (in_array($ds, $holidayDates)) continue;
            $workingDays++;
        }

        // Recalculate attendance_percentage using class working_days (not per-student total)
        foreach ($report as &$row) {
            $row['working_days'] = $workingDays;
            $row['attendance_percentage'] = $workingDays > 0
                ? round(($row['present_days'] / $workingDays) * 100, 2)
                : 0;
        }
        unset($row);

        // Get session info
        $sessionInfo = $this->db->prepare('SELECT name, year FROM academic_sessions WHERE id = ?');
        $sessionInfo->execute([$sessionId]);
        $session = $sessionInfo->fetch();

        Response::success([
            'report'       => $report,
            'session'      => $session,
            'month'        => $month,
            'class'        => $className,
            'holidays'     => $holidayDates,
            'working_days' => $workingDays,
        ]);
    }

    // GET /attendance/dates?class=ক্লাস ৮&month=2026-04&session_id=1
    public function dates(): void {
        $className = $_GET['class'] ?? '';
        $month = $_GET['month'] ?? date('Y-m');
        $sessionId = $_GET['session_id'] ?? null;
        
        if (!$className) {
            Response::error('class parameter required');
        }

        // Get current session if not provided
        if (!$sessionId) {
            $sessionStmt = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1');
            $currentSession = $sessionStmt->fetch();
            if ($currentSession) {
                $sessionId = $currentSession['id'];
            }
        }

        // Get class_id
        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) {
            Response::error('Class not found', 404);
        }
        $classId = $clsRow['id'];

        // Get distinct dates when attendance was taken
        $stmt = $this->db->prepare(
            'SELECT DISTINCT date, COUNT(DISTINCT student_id) as students_marked
             FROM attendance 
             WHERE session_id = ? AND class_id = ? AND month = ?
             GROUP BY date
             ORDER BY date DESC'
        );
        $stmt->execute([$sessionId, $classId, $month]);
        $dates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        Response::success([
            'dates' => $dates,
            'session_id' => $sessionId,
            'month' => $month
        ]);
    }

    // GET /attendance/summary?class=ক্লাস ৮&session_id=1
    public function summary(): void {
        $className = $_GET['class'] ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        
        if (!$className) {
            Response::error('class parameter required');
        }

        if (!$sessionId) {
            $sessionStmt = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1');
            $currentSession = $sessionStmt->fetch();
            if ($currentSession) $sessionId = $currentSession['id'];
        }

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::error('Class not found', 404);
        $classId = $clsRow['id'];

        // Get all holiday dates for the current month to exclude from rate
        $currentMonth = date('Y-m');
        $holidayDates = HolidayController::getHolidayDatesInMonth($this->db, $currentMonth);
        $excludeClause = count($holidayDates) > 0
            ? 'AND date NOT IN (' . implode(',', array_fill(0, count($holidayDates), '?')) . ')'
            : '';

        $sql = "SELECT 
                COUNT(DISTINCT date) as total_days_recorded,
                COUNT(DISTINCT student_id) as total_students,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as total_present,
                COUNT(CASE WHEN status = 'absent'  THEN 1 END) as total_absent,
                COUNT(CASE WHEN status = 'late'    THEN 1 END) as total_late,
                COUNT(CASE WHEN status = 'excused' THEN 1 END) as total_excused,
                ROUND((COUNT(CASE WHEN status = 'present' THEN 1 END) / NULLIF(COUNT(*), 0)) * 100, 2) as overall_attendance_rate
             FROM attendance
             WHERE session_id = ? AND class_id = ? $excludeClause";

        $params = [$sessionId, $classId];
        if (count($holidayDates) > 0) $params = array_merge($params, $holidayDates);

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $summary = $stmt->fetch(PDO::FETCH_ASSOC);

        Response::success($summary);
    }

    // GET /attendance/student-stats?student_id=DMM-STU-2026-0001&session_id=1&class_id=5
    // Returns weekly, monthly, and yearly attendance ratio for a single student
    public function studentStats(): void {
        Auth::require();
        $studentId = $_GET['student_id'] ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $classId   = $_GET['class_id']   ?? null;

        if (!$studentId) Response::error('student_id required');

        if (!$sessionId) {
            $s = $this->db->query('SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1')->fetch();
            if ($s) $sessionId = $s['id'];
        }

        // If class_id not provided, look it up from the student record
        if (!$classId) {
            $cStmt = $this->db->prepare('SELECT class_id FROM students WHERE id = ?');
            $cStmt->execute([$studentId]);
            $cRow = $cStmt->fetch();
            if ($cRow) $classId = $cRow['class_id'];
        }


        // ── Weekly ────────────────────────────────────────────────────────
        $weekStart = date('Y-m-d', strtotime('-6 days'));
        $weekEnd   = date('Y-m-d');

        $weekDeclared = [];
        try {
            $wdHolStmt = $this->db->prepare('SELECT date FROM holidays WHERE date BETWEEN ? AND ?');
            $wdHolStmt->execute([$weekStart, $weekEnd]);
            $weekDeclared = array_column($wdHolStmt->fetchAll(PDO::FETCH_ASSOC), 'date');
        } catch (\Exception $e) {}


        // Working days = total days in week range - Fridays - declared holidays
        $weekWorkingDays = 0;
        $wdStart = new \DateTime($weekStart);
        $wdEnd   = new \DateTime($weekEnd);
        for ($d = clone $wdStart; $d <= $wdEnd; $d->modify('+1 day')) {
            $ds = $d->format('Y-m-d');
            if ($d->format('N') == 5) continue; // Friday
            if (in_array($ds, $weekDeclared)) continue;
            $weekWorkingDays++;
        }

        // Fetch student's actual recorded attendance — no holiday/Friday filter needed
        // (teacher wouldn't record attendance on those days anyway)
        $wSql = "SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                        SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END) as absent,
                        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
                 FROM attendance WHERE student_id = ? AND session_id = ? AND date BETWEEN ? AND ?";
        $wStmt = $this->db->prepare($wSql);
        $wStmt->execute([$studentId, $sessionId, $weekStart, $weekEnd]);
        $week = $wStmt->fetch(PDO::FETCH_ASSOC);

        // ── Monthly ───────────────────────────────────────────────────────
        $currentMonth  = date('Y-m');
        $monthDeclared = [];
        try {
            $mHolStmt = $this->db->prepare('SELECT date FROM holidays WHERE date LIKE ?');
            $mHolStmt->execute([$currentMonth . '%']);
            $monthDeclared = array_column($mHolStmt->fetchAll(PDO::FETCH_ASSOC), 'date');
        } catch (\Exception $e) {}


        // Working days = days passed so far in current month - Fridays - declared holidays
        [$cmYear, $cmMonth] = explode('-', $currentMonth);
        $cmDaysInMonth = (int)date('t', mktime(0, 0, 0, (int)$cmMonth, 1, (int)$cmYear));
        $cmCountUpTo = ($currentMonth === date('Y-m')) ? (int)date('j') : $cmDaysInMonth;
        $monthWorkingDays = 0;
        for ($d = 1; $d <= $cmCountUpTo; $d++) {
            $ds = sprintf('%s-%02d', $currentMonth, $d);
            if (date('N', mktime(0, 0, 0, (int)$cmMonth, $d, (int)$cmYear)) == 5) continue; // Friday
            if (in_array($ds, $monthDeclared)) continue;
            $monthWorkingDays++;
        }

        $mSql = "SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                        SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END) as absent,
                        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
                 FROM attendance WHERE student_id = ? AND session_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?";
        $mStmt = $this->db->prepare($mSql);
        $mStmt->execute([$studentId, $sessionId, $currentMonth]);
        $month = $mStmt->fetch(PDO::FETCH_ASSOC);

        // ── Yearly ────────────────────────────────────────────────────────
        $currentYear  = date('Y');
        $yearDeclared = [];
        try {
            $yHolStmt = $this->db->prepare('SELECT date FROM holidays WHERE YEAR(date) = ?');
            $yHolStmt->execute([$currentYear]);
            $yearDeclared = array_column($yHolStmt->fetchAll(PDO::FETCH_ASSOC), 'date');
        } catch (\Exception $e) {}


        // Working days = days passed so far in current year - Fridays - declared holidays
        $yearWorkingDays = 0;
        $todayDate = new \DateTime(date('Y-m-d'));
        for ($m = 1; $m <= 12; $m++) {
            $dim = (int)date('t', mktime(0, 0, 0, $m, 1, (int)$currentYear));
            for ($d = 1; $d <= $dim; $d++) {
                $ds = sprintf('%04d-%02d-%02d', $currentYear, $m, $d);
                if (new \DateTime($ds) > $todayDate) break 2; // stop at today
                if (date('N', mktime(0, 0, 0, $m, $d, (int)$currentYear)) == 5) continue; // Friday
                if (in_array($ds, $yearDeclared)) continue;
                $yearWorkingDays++;
            }
        }

        $ySql = "SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                        SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END) as absent,
                        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
                 FROM attendance WHERE student_id = ? AND session_id = ? AND YEAR(date) = ?";
        $yStmt = $this->db->prepare($ySql);
        $yStmt->execute([$studentId, $sessionId, (int)$currentYear]);
        $year = $yStmt->fetch(PDO::FETCH_ASSOC);

        $pct = function($present, $recorded) {
            // Rate = present ÷ days attendance was actually recorded (not total working days)
            return $recorded > 0 ? round(($present / $recorded) * 100, 1) : null;
        };

        $weekRecorded  = (int)($week['total']  ?? 0);
        $monthRecorded = (int)($month['total'] ?? 0);
        $yearRecorded  = (int)($year['total']  ?? 0);

        Response::success([
            'student_id' => $studentId,
            'session_id' => $sessionId,
            'weekly' => [
                'working_days'  => $weekWorkingDays,
                'recorded_days' => $weekRecorded,
                'present'       => (int)($week['present'] ?? 0),
                'absent'        => (int)($week['absent']  ?? 0),
                'excused'       => (int)($week['excused'] ?? 0),
                'not_recorded'  => max(0, $weekWorkingDays - $weekRecorded),
                'rate'          => $pct($week['present'] ?? 0, $weekRecorded),
            ],
            'monthly' => [
                'month'         => $currentMonth,
                'working_days'  => $monthWorkingDays,
                'recorded_days' => $monthRecorded,
                'present'       => (int)($month['present'] ?? 0),
                'absent'        => (int)($month['absent']  ?? 0),
                'excused'       => (int)($month['excused'] ?? 0),
                'not_recorded'  => max(0, $monthWorkingDays - $monthRecorded),
                'rate'          => $pct($month['present'] ?? 0, $monthRecorded),
            ],
            'yearly' => [
                'year'          => $currentYear,
                'working_days'  => $yearWorkingDays,
                'recorded_days' => $yearRecorded,
                'present'       => (int)($year['present'] ?? 0),
                'absent'        => (int)($year['absent']  ?? 0),
                'excused'       => (int)($year['excused'] ?? 0),
                'not_recorded'  => max(0, $yearWorkingDays - $yearRecorded),
                'rate'          => $pct($year['present'] ?? 0, $yearRecorded),
            ],
        ]);
    }
}
