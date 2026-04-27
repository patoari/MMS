<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SearchController {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::connect();
    }

    /**
     * Search students across all sessions or specific session
     */
    public function searchStudents(): void {
        Auth::require();
        
        $query = $_GET['q'] ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        
        $sql = "SELECT s.*, c.name AS class_name, sess.name AS session_name, sess.year
                FROM students s
                JOIN classes c ON c.id = s.class_id
                JOIN academic_sessions sess ON sess.id = s.session_id
                WHERE s.deleted_at IS NULL";
        
        $params = [];
        
        if ($query) {
            $sql .= " AND (s.name LIKE ? OR s.id LIKE ? OR s.phone LIKE ?)";
            $params[] = "%$query%";
            $params[] = "%$query%";
            $params[] = "%$query%";
        }
        
        if ($sessionId) {
            $sql .= " AND s.session_id = ?";
            $params[] = $sessionId;
        }
        
        if ($classId) {
            $sql .= " AND s.class_id = ?";
            $params[] = $classId;
        }
        
        $sql .= " ORDER BY sess.year DESC, s.name";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll();
        
        Response::success($results);
    }
    
    /**
     * Search exam results across sessions
     */
    public function searchResults(): void {
        Auth::require();
        
        $studentId = $_GET['student_id'] ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $examId = $_GET['exam_id'] ?? null;
        
        $sql = "SELECT r.*, e.name AS exam_name, e.date AS exam_date,
                       s.name AS student_name, c.name AS class_name,
                       sess.name AS session_name, sess.year
                FROM results r
                JOIN exams e ON e.id = r.exam_id
                JOIN students s ON s.id = r.student_id
                JOIN classes c ON c.id = s.class_id
                JOIN academic_sessions sess ON sess.id = r.session_id
                WHERE 1=1";
        
        $params = [];
        
        if ($studentId) {
            $sql .= " AND r.student_id = ?";
            $params[] = $studentId;
        }
        
        if ($sessionId) {
            $sql .= " AND r.session_id = ?";
            $params[] = $sessionId;
        }
        
        if ($examId) {
            $sql .= " AND r.exam_id = ?";
            $params[] = $examId;
        }
        
        $sql .= " ORDER BY sess.year DESC, e.date DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll();
        
        Response::success($results);
    }
    
    /**
     * Search receipts across sessions
     */
    public function searchReceipts(): void {
        Auth::require();
        
        $query = $_GET['q'] ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $month = $_GET['month'] ?? null;
        $year = $_GET['year'] ?? null;
        $studentId = $_GET['student_id'] ?? null;
        
        $sql = "SELECT pr.*, s.name AS student_name, c.name AS class_name,
                       sess.name AS session_name, sess.year AS session_year
                FROM payment_receipts pr
                LEFT JOIN fees f ON f.id = pr.fee_id
                LEFT JOIN students s ON s.id = f.student_id
                LEFT JOIN classes c ON c.id = s.class_id
                JOIN academic_sessions sess ON sess.id = pr.session_id
                WHERE 1=1";
        
        $params = [];
        
        if ($query) {
            $sql .= " AND (pr.receipt_no LIKE ? OR s.name LIKE ?)";
            $params[] = "%$query%";
            $params[] = "%$query%";
        }
        
        if ($sessionId) {
            $sql .= " AND pr.session_id = ?";
            $params[] = $sessionId;
        }
        
        if ($studentId) {
            $sql .= " AND s.id = ?";
            $params[] = $studentId;
        }
        
        if ($month && $year) {
            $sql .= " AND MONTH(pr.payment_date) = ? AND YEAR(pr.payment_date) = ?";
            $params[] = $month;
            $params[] = $year;
        } elseif ($year) {
            $sql .= " AND YEAR(pr.payment_date) = ?";
            $params[] = $year;
        }
        
        $sql .= " ORDER BY pr.payment_date DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll();
        
        Response::success($results);
    }
    
    /**
     * Search fees across sessions
     */
    public function searchFees(): void {
        Auth::require();
        
        $studentId = $_GET['student_id'] ?? null;
        $sessionId = $_GET['session_id'] ?? null;
        $status = $_GET['status'] ?? null; // paid, unpaid, partial
        
        $sql = "SELECT f.*, s.name AS student_name, s.id AS student_id,
                       c.name AS class_name, sess.name AS session_name, sess.year
                FROM fees f
                JOIN students s ON s.id = f.student_id
                JOIN classes c ON c.id = s.class_id
                JOIN academic_sessions sess ON sess.id = f.session_id
                WHERE 1=1";
        
        $params = [];
        
        if ($studentId) {
            $sql .= " AND f.student_id = ?";
            $params[] = $studentId;
        }
        
        if ($sessionId) {
            $sql .= " AND f.session_id = ?";
            $params[] = $sessionId;
        }
        
        if ($status === 'paid') {
            $sql .= " AND f.paid >= f.amount";
        } elseif ($status === 'unpaid') {
            $sql .= " AND f.paid = 0";
        } elseif ($status === 'partial') {
            $sql .= " AND f.paid > 0 AND f.paid < f.amount";
        }
        
        $sql .= " ORDER BY sess.year DESC, f.created_at DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll();
        
        Response::success($results);
    }
    
    /**
     * Get student's complete academic history
     */
    public function studentHistory(): void {
        $user = Auth::requireRole('student');
        
        // Get student ID from user
        $stmt = $this->db->prepare("SELECT id FROM students WHERE user_id = ? LIMIT 1");
        $stmt->execute([$user['id']]);
        $student = $stmt->fetch();
        
        if (!$student) {
            Response::error('Student profile not found', 404);
        }
        
        $studentId = $student['id'];
        
        // Get all sessions this student was enrolled in
        $sessionsStmt = $this->db->prepare("
            SELECT DISTINCT sess.*
            FROM academic_sessions sess
            WHERE sess.id IN (
                SELECT DISTINCT session_id FROM students WHERE id = ?
                UNION
                SELECT DISTINCT session_id FROM results WHERE student_id = ?
                UNION
                SELECT DISTINCT session_id FROM fees WHERE student_id = ?
            )
            ORDER BY sess.year DESC
        ");
        $sessionsStmt->execute([$studentId, $studentId, $studentId]);
        $sessions = $sessionsStmt->fetchAll();
        
        // Get results for all sessions
        $resultsStmt = $this->db->prepare("
            SELECT r.*, e.name AS exam_name, e.date AS exam_date,
                   sess.name AS session_name, sess.year
            FROM results r
            JOIN exams e ON e.id = r.exam_id
            JOIN academic_sessions sess ON sess.id = r.session_id
            WHERE r.student_id = ?
            ORDER BY sess.year DESC, e.date DESC
        ");
        $resultsStmt->execute([$studentId]);
        $results = $resultsStmt->fetchAll();
        
        // Get fees for all sessions
        $feesStmt = $this->db->prepare("
            SELECT f.*, sess.name AS session_name, sess.year
            FROM fees f
            JOIN academic_sessions sess ON sess.id = f.session_id
            WHERE f.student_id = ?
            ORDER BY sess.year DESC, f.created_at DESC
        ");
        $feesStmt->execute([$studentId]);
        $fees = $feesStmt->fetchAll();
        
        // Get receipts for all sessions
        $receiptsStmt = $this->db->prepare("
            SELECT pr.*, sess.name AS session_name, sess.year
            FROM payment_receipts pr
            JOIN fees f ON f.id = pr.fee_id
            JOIN academic_sessions sess ON sess.id = pr.session_id
            WHERE f.student_id = ?
            ORDER BY pr.payment_date DESC
        ");
        $receiptsStmt->execute([$studentId]);
        $receipts = $receiptsStmt->fetchAll();
        
        Response::success([
            'student_id' => $studentId,
            'sessions' => $sessions,
            'results' => $results,
            'fees' => $fees,
            'receipts' => $receipts
        ]);
    }
}
