<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class PromotionController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    // GET /promotions?exam_id=EXM-006
    public function index(): void {
        Auth::requireRole('admin');
        $examId = $_GET['exam_id'] ?? '';
        if (!$examId) Response::error('exam_id required');

        $stmt = $this->db->prepare("
            SELECT p.*, s.name AS student_name, s.photo,
                   cf.name AS from_class, ct.name AS to_class
            FROM promotions p
            JOIN students s  ON s.id = p.student_id
            JOIN classes cf  ON cf.id = p.from_class_id
            LEFT JOIN classes ct ON ct.id = p.to_class_id
            WHERE p.exam_id = ?
            ORDER BY p.rank_in_class ASC
        ");
        $stmt->execute([$examId]);
        Response::success($stmt->fetchAll());
    }

    // POST /promotions  { exam_id, academic_year }
    public function run(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $examId = $body['exam_id'] ?? '';
        $year   = (int)($body['academic_year'] ?? date('Y'));

        if (!$examId) Response::error('exam_id required');

        // Verify exam exists
        $exam = $this->db->prepare("SELECT id, class_id, pass_mark_percent FROM exams WHERE id = ?");
        $exam->execute([$examId]);
        $examRow = $exam->fetch();
        if (!$examRow) Response::error('Exam not found', 404);

        // Check results exist
        $count = $this->db->prepare("SELECT COUNT(*) FROM results WHERE exam_id = ?");
        $count->execute([$examId]);
        if ((int)$count->fetchColumn() === 0) Response::error('No results found for this exam');

        // Call stored procedure
        $stmt = $this->db->prepare("CALL promote_students(?, ?)");
        $stmt->execute([$examId, $year]);
        $rows = $stmt->fetchAll();

        Response::success($rows, 'Promotion completed successfully');
    }

    // GET /promotions/annual-exams  — list exams marked as annual with result counts
    public function annualExams(): void {
        Auth::requireRole('admin');
        
        $stmt = $this->db->query("
            SELECT e.id, e.name, e.class_id, COALESCE(c.name, 'সকল শ্রেণি') AS class_name,
                   e.start_date, e.end_date, e.status, e.pass_mark_percent,
                   e.is_annual,
                   COUNT(DISTINCT r.student_id) AS result_count,
                   COUNT(DISTINCT p.student_id) AS promoted_count
            FROM exams e
            LEFT JOIN classes c ON c.id = e.class_id
            LEFT JOIN results r ON r.exam_id = e.id
            LEFT JOIN promotions p ON p.exam_id = e.id
            WHERE e.status = 'সম্পন্ন' AND e.is_annual = 1
            GROUP BY e.id
            ORDER BY e.start_date DESC
        ");
        $result = $stmt->fetchAll();
        Response::success($result);
    }

    // PUT /promotions/mark-annual  { exam_id, is_annual, pass_mark_percent }
    public function markAnnual(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $examId   = $body['exam_id'] ?? '';
        $isAnnual = isset($body['is_annual']) ? (int)$body['is_annual'] : 1;
        $passPct  = (int)($body['pass_mark_percent'] ?? 33);

        if (!$examId) Response::error('exam_id required');

        $stmt = $this->db->prepare("UPDATE exams SET is_annual = ?, pass_mark_percent = ? WHERE id = ?");
        $stmt->execute([$isAnnual, $passPct, $examId]);
        Response::success(null, 'Exam updated');
    }
    
    // POST /promotions/manual - Manually promote a failed student
    public function manualPromote(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $examId     = $body['exam_id'] ?? '';
        $studentId  = $body['student_id'] ?? '';
        $year       = (int)($body['academic_year'] ?? date('Y'));

        if (!$examId || !$studentId) Response::error('exam_id and student_id required');

        // Check if student exists in promotions and is not already promoted
        $check = $this->db->prepare("SELECT id, is_promoted, from_class_id FROM promotions WHERE exam_id = ? AND student_id = ?");
        $check->execute([$examId, $studentId]);
        $promotion = $check->fetch();

        if (!$promotion) Response::error('Student not found in promotion records', 404);
        if ($promotion['is_promoted'] == 1) Response::error('Student is already promoted', 400);

        // Get next class - simpler approach
        $nextClass = $this->db->prepare("
            SELECT id 
            FROM classes 
            WHERE id > ? 
            ORDER BY id ASC 
            LIMIT 1
        ");
        $nextClass->execute([$promotion['from_class_id']]);
        $next = $nextClass->fetch();

        if (!$next || !$next['id']) Response::error('No next class available', 400);

        // Get next available roll number in the new class
        $maxRoll = $this->db->prepare("SELECT COALESCE(MAX(roll), 0) as max_roll FROM students WHERE class_id = ?");
        $maxRoll->execute([$next['id']]);
        $newRoll = ((int)$maxRoll->fetchColumn()) + 1;

        // Update promotion record
        $this->db->prepare("
            UPDATE promotions 
            SET is_promoted = 1, to_class_id = ?, new_roll = ?
            WHERE exam_id = ? AND student_id = ?
        ")->execute([$next['id'], $newRoll, $examId, $studentId]);

        // Update student record
        $this->db->prepare("
            UPDATE students 
            SET class_id = ?, roll = ?
            WHERE id = ?
        ")->execute([$next['id'], $newRoll, $studentId]);

        Response::success(null, 'Student manually promoted successfully');
    }
    
    // POST /promotions/demote - Demote a promoted student (revert promotion)
    public function demote(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $examId     = $body['exam_id'] ?? '';
        $studentId  = $body['student_id'] ?? '';

        if (!$examId || !$studentId) Response::error('exam_id and student_id required');

        // Check if student exists in promotions and is promoted
        $check = $this->db->prepare("
            SELECT id, is_promoted, from_class_id, to_class_id, new_roll 
            FROM promotions 
            WHERE exam_id = ? AND student_id = ?
        ");
        $check->execute([$examId, $studentId]);
        $promotion = $check->fetch();

        if (!$promotion) Response::error('Student not found in promotion records', 404);
        if ($promotion['is_promoted'] == 0) Response::error('Student is not promoted', 400);

        // Get student's original roll number before promotion
        $originalRoll = $this->db->prepare("
            SELECT roll FROM students WHERE id = ? 
            AND class_id = ?
        ");
        $originalRoll->execute([$studentId, $promotion['from_class_id']]);
        $origRoll = $originalRoll->fetchColumn();
        
        // If no original roll found, get the max roll + 1 in the original class
        if (!$origRoll) {
            $maxRoll = $this->db->prepare("SELECT COALESCE(MAX(roll), 0) as max_roll FROM students WHERE class_id = ?");
            $maxRoll->execute([$promotion['from_class_id']]);
            $origRoll = ((int)$maxRoll->fetchColumn()) + 1;
        }

        // Update promotion record - set back to not promoted
        $this->db->prepare("
            UPDATE promotions 
            SET is_promoted = 0, to_class_id = NULL, new_roll = NULL
            WHERE exam_id = ? AND student_id = ?
        ")->execute([$examId, $studentId]);

        // Revert student record to original class
        $this->db->prepare("
            UPDATE students 
            SET class_id = ?, roll = ?
            WHERE id = ?
        ")->execute([$promotion['from_class_id'], $origRoll, $studentId]);

        Response::success(null, 'Student promotion reverted successfully');
    }
}
