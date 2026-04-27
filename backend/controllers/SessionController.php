<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SessionController {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::connect();
    }

    /**
     * Get all academic sessions
     */
    public function index(): void {
        Auth::require();
        
        $stmt = $this->db->query("
            SELECT * FROM academic_sessions 
            ORDER BY year DESC, id DESC
        ");
        $sessions = $stmt->fetchAll();
        
        Response::success($sessions);
    }
    
    /**
     * Get all sessions (public access for result check page)
     */
    public function all(): void {
        $stmt = $this->db->query("
            SELECT id, name, year, is_current, is_locked 
            FROM academic_sessions 
            ORDER BY year DESC, id DESC
        ");
        $sessions = $stmt->fetchAll();
        
        Response::success($sessions);
    }

    /**
     * Get current active session
     */
    public function current(): void {
        $stmt = $this->db->query("
            SELECT * FROM academic_sessions 
            WHERE is_current = 1 
            LIMIT 1
        ");
        $session = $stmt->fetch();
        
        // Return null instead of 404 — no current session is a valid state
        Response::success($session ?: null);
    }

    /**
     * Create a new academic session
     */
    public function store(): void {
        Auth::requireRole('admin');
        
        $body = json_decode(file_get_contents('php://input'), true);
        
        $required = ['name', 'year', 'start_date', 'end_date'];
        foreach ($required as $field) {
            if (empty($body[$field])) {
                Response::error("Field '$field' is required");
            }
        }
        
        // Check if session already exists for this year
        $checkStmt = $this->db->prepare("
            SELECT id FROM academic_sessions WHERE year = ?
        ");
        $checkStmt->execute([$body['year']]);
        if ($checkStmt->fetch()) {
            Response::error('Session for this year already exists');
        }
        
        $stmt = $this->db->prepare("
            INSERT INTO academic_sessions (name, year, start_date, end_date, is_current, is_locked)
            VALUES (?, ?, ?, ?, 0, 0)
        ");
        
        $stmt->execute([
            $body['name'],
            $body['year'],
            $body['start_date'],
            $body['end_date']
        ]);
        
        $newId = $this->db->lastInsertId();
        
        Response::success(['id' => $newId], 'Session created successfully', 201);
    }

    /**
     * Update session details
     */
    public function update(int $id): void {
        Auth::requireRole('admin');
        
        $body = json_decode(file_get_contents('php://input'), true);
        
        // Check if session is locked
        $checkStmt = $this->db->prepare("SELECT is_locked FROM academic_sessions WHERE id = ?");
        $checkStmt->execute([$id]);
        $session = $checkStmt->fetch();
        
        if (!$session) {
            Response::error('Session not found', 404);
        }
        
        if ($session['is_locked'] && !isset($body['force_unlock'])) {
            Response::error('Cannot modify locked session');
        }
        
        $fields = [];
        $params = [];
        
        $allowed = ['name', 'year', 'start_date', 'end_date'];
        foreach ($allowed as $field) {
            if (isset($body[$field])) {
                $fields[] = "$field = ?";
                $params[] = $body[$field];
            }
        }
        
        if (empty($fields)) {
            Response::error('Nothing to update');
        }
        
        $params[] = $id;
        
        $stmt = $this->db->prepare("
            UPDATE academic_sessions 
            SET " . implode(', ', $fields) . " 
            WHERE id = ?
        ");
        $stmt->execute($params);
        
        Response::success(null, 'Session updated successfully');
    }

    /**
     * Activate a session (make it current)
     * Creates snapshot of previous session before switching
     */
    public function activate(int $id): void {
        Auth::requireRole('admin');
        
        // Check if session exists
        $checkStmt = $this->db->prepare("SELECT * FROM academic_sessions WHERE id = ?");
        $checkStmt->execute([$id]);
        $newSession = $checkStmt->fetch();
        
        if (!$newSession) {
            Response::error('Session not found', 404);
        }
        
        if ($newSession['is_current']) {
            Response::error('This session is already current');
        }
        
        try {
            $this->db->beginTransaction();
            
            // Get current session
            $currentStmt = $this->db->query("
                SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1
            ");
            $currentSession = $currentStmt->fetch();
            
            // Create snapshot of current session before switching
            if ($currentSession) {
                $this->createSnapshot($currentSession['id']);
            }
            
            // Deactivate all sessions
            $this->db->exec("UPDATE academic_sessions SET is_current = 0");
            
            // Activate new session
            $activateStmt = $this->db->prepare("
                UPDATE academic_sessions SET is_current = 1 WHERE id = ?
            ");
            $activateStmt->execute([$id]);
            
            // Generate session fees for all existing students
            // Get all active students with their class fee setting
            $studentsStmt = $this->db->query("
                SELECT s.id AS student_id, s.class_id, fs.session AS amount
                FROM students s
                JOIN fee_settings fs ON fs.class_id = s.class_id
                WHERE s.deleted_at IS NULL AND fs.session > 0
            ");
            $students = $studentsStmt->fetchAll();
            
            $sessionFeesCreated = 0;
            foreach ($students as $row) {
                // Skip if session fee already exists for this student in this session
                $checkFee = $this->db->prepare(
                    "SELECT id FROM fees WHERE student_id = ? AND category = 'সেশন ফি' AND session_id = ?"
                );
                $checkFee->execute([$row['student_id'], $id]);
                if ($checkFee->fetch()) continue;
                
                // Create session fee
                $feeId = 'FEE-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -6));
                $this->db->prepare(
                    "INSERT INTO fees (id, student_id, category, month, amount, paid, status, session_id)
                     VALUES (?, ?, 'সেশন ফি', ?, ?, 0, 'বকেয়া', ?)"
                )->execute([$feeId, $row['student_id'], 'শিক্ষাবর্ষ ' . $newSession['year'], $row['amount'], $id]);
                $sessionFeesCreated++;
            }
            
            $this->db->commit();
            
            Response::success([
                'session_id' => $id,
                'session_name' => $newSession['name'],
                'session_fees_created' => $sessionFeesCreated
            ], 'Session activated successfully. ' . $sessionFeesCreated . ' session fees created for existing students.');
            
        } catch (Exception $e) {
            $this->db->rollBack();
            Response::error('Failed to activate session: ' . $e->getMessage());
        }
    }

    /**
     * Lock a session to prevent modifications
     */
    public function lock(int $id): void {
        Auth::requireRole('admin');
        
        // Check if it's the current session
        $checkStmt = $this->db->prepare("
            SELECT is_current FROM academic_sessions WHERE id = ?
        ");
        $checkStmt->execute([$id]);
        $session = $checkStmt->fetch();
        
        if (!$session) {
            Response::error('Session not found', 404);
        }
        
        if ($session['is_current']) {
            Response::error('Cannot lock the current active session');
        }
        
        // Create snapshot before locking
        $this->createSnapshot($id);
        
        // Lock the session
        $stmt = $this->db->prepare("
            UPDATE academic_sessions SET is_locked = 1 WHERE id = ?
        ");
        $stmt->execute([$id]);
        
        Response::success(null, 'Session locked successfully');
    }

    /**
     * Create a snapshot of session data
     */
    public function snapshot(int $id): void {
        Auth::requireRole('admin');
        
        try {
            $this->createSnapshot($id);
            Response::success(null, 'Snapshot created successfully');
        } catch (Exception $e) {
            Response::error('Failed to create snapshot: ' . $e->getMessage());
        }
    }

    /**
     * Get students in a specific session
     */
    public function sessionStudents(int $id): void {
        Auth::require();
        
        $stmt = $this->db->prepare("
            SELECT s.*, c.name AS class_name
            FROM students s
            JOIN classes c ON c.id = s.class_id
            WHERE s.session_id = ? AND s.deleted_at IS NULL
            ORDER BY c.sort_order, s.roll
        ");
        $stmt->execute([$id]);
        $students = $stmt->fetchAll();
        
        Response::success($students);
    }

    /**
     * Get teachers in a specific session
     */
    public function sessionTeachers(int $id): void {
        Auth::require();
        
        $stmt = $this->db->prepare("
            SELECT * FROM teachers
            WHERE session_id = ? AND deleted_at IS NULL
            ORDER BY name
        ");
        $stmt->execute([$id]);
        $teachers = $stmt->fetchAll();
        
        Response::success($teachers);
    }

    /**
     * Get fees in a specific session
     */
    public function sessionFees(int $id): void {
        Auth::require();
        
        $stmt = $this->db->prepare("
            SELECT f.*, s.name AS student_name, c.name AS class_name
            FROM fees f
            JOIN students s ON s.id = f.student_id
            JOIN classes c ON c.id = s.class_id
            WHERE f.session_id = ?
            ORDER BY f.created_at DESC
        ");
        $stmt->execute([$id]);
        $fees = $stmt->fetchAll();
        
        Response::success($fees);
    }

    /**
     * Get session statistics
     */
    public function statistics(int $id): void {
        Auth::require();
        
        // Get comprehensive statistics for the session
        $stats = [];
        
        // Student count
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count FROM students 
            WHERE session_id = ? AND deleted_at IS NULL
        ");
        $stmt->execute([$id]);
        $stats['total_students'] = (int)$stmt->fetchColumn();
        
        // Teacher count
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count FROM teachers 
            WHERE session_id = ? AND deleted_at IS NULL
        ");
        $stmt->execute([$id]);
        $stats['total_teachers'] = (int)$stmt->fetchColumn();
        
        // Exam count
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count FROM exams WHERE session_id = ?
        ");
        $stmt->execute([$id]);
        $stats['total_exams'] = (int)$stmt->fetchColumn();
        
        // Fee statistics
        $stmt = $this->db->prepare("
            SELECT 
                COUNT(*) as total_fees,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(paid), 0) as total_paid,
                COALESCE(SUM(amount - paid), 0) as total_due
            FROM fees WHERE session_id = ?
        ");
        $stmt->execute([$id]);
        $feeStats = $stmt->fetch();
        $stats['fees'] = $feeStats;
        
        // Result count
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count FROM results WHERE session_id = ?
        ");
        $stmt->execute([$id]);
        $stats['total_results'] = (int)$stmt->fetchColumn();
        
        // Receipt count
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count FROM payment_receipts WHERE session_id = ?
        ");
        $stmt->execute([$id]);
        $stats['total_receipts'] = (int)$stmt->fetchColumn();
        
        Response::success($stats);
    }

    /**
     * Private helper: Create snapshot of session data
     */
    private function createSnapshot(int $sessionId): void {
        // Delete existing snapshots for this session to avoid duplicates
        $this->db->prepare("
            DELETE FROM student_session_history WHERE session_id = ?
        ")->execute([$sessionId]);
        
        $this->db->prepare("
            DELETE FROM teacher_session_history WHERE session_id = ?
        ")->execute([$sessionId]);
        
        // Snapshot students
        $this->db->prepare("
            INSERT INTO student_session_history (student_id, session_id, class_id, roll, section, status)
            SELECT id, session_id, class_id, roll, section, status
            FROM students
            WHERE session_id = ? AND deleted_at IS NULL
        ")->execute([$sessionId]);
        
        // Snapshot teachers (matching actual table structure)
        $this->db->prepare("
            INSERT INTO teacher_session_history (teacher_id, session_id, class_id, subject, salary, status)
            SELECT id, session_id, class_id, subject, salary, status
            FROM teachers
            WHERE session_id = ? AND deleted_at IS NULL
        ")->execute([$sessionId]);
    }
}
