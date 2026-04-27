<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class ResultController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    private function calcGrade(int $obtained, int $total): string {
        // Prevent division by zero
        if ($total <= 0) {
            return 'F';
        }
        
        $pct = ($obtained / $total) * 100;
        if ($pct >= 80) return 'A+';
        if ($pct >= 70) return 'A';
        if ($pct >= 60) return 'A-';
        if ($pct >= 50) return 'B';
        if ($pct >= 40) return 'C';
        if ($pct >= 33) return 'D';
        return 'F';
    }

    // Bulk save marks: [{student_id, exam_id, subject_id, obtained, total_marks}]
    // Teachers save as 'pending', admin saves as 'published' directly
    public function bulkStore(): void {
        Auth::requireRole('admin', 'teacher', 'class_teacher');
        $user  = Auth::user();
        if (!$user) Response::error('Authentication required', 401);
        
        $items = json_decode(file_get_contents('php://input'), true);
        if (!is_array($items) || empty($items)) Response::error('No data provided');

        $isAdmin = $user['role'] === 'admin';
        $status  = $isAdmin ? 'published' : 'pending';

        $examId = null;
        foreach ($items['results'] ?? $items as $item) {
            if (!empty($item['exam_id'])) { $examId = $item['exam_id']; break; }
        }

        $sessionId = null;
        if ($examId) {
            $examStmt = $this->db->prepare("SELECT session_id FROM exams WHERE id = ?");
            $examStmt->execute([$examId]);
            $examRow = $examStmt->fetch();
            if ($examRow) $sessionId = $examRow['session_id'];
        }

        $sql = "INSERT INTO results (student_id, exam_id, subject_id, subject_name, total_marks, obtained, grade, session_id, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  total_marks  = VALUES(total_marks),
                  obtained     = VALUES(obtained),
                  grade        = VALUES(grade),
                  subject_name = VALUES(subject_name),
                  session_id   = VALUES(session_id),
                  status       = IF(status = 'published', 'published', VALUES(status))";
        $stmt = $this->db->prepare($sql);

        try {
            $this->db->beginTransaction();
            foreach ($items['results'] ?? $items as $item) {
                if (!$examId) $examId = $item['exam_id'];

                $subjectId   = $item['subject_id']   ?? null;
                $subjectName = $item['subject_name'] ?? null;

                if (empty($subjectId) && !empty($subjectName)) {
                    $sub = $this->db->prepare('SELECT id FROM subjects WHERE name = ?');
                    $sub->execute([$subjectName]);
                    $subRow = $sub->fetch();
                    if ($subRow) { $subjectId = $subRow['id']; }
                    else {
                        $this->db->prepare('INSERT IGNORE INTO subjects (name) VALUES (?)')->execute([$subjectName]);
                        $newId = (int)$this->db->lastInsertId();
                        $subjectId = $newId > 0 ? $newId : null;
                    }
                }
                if (!empty($subjectId) && empty($subjectName)) {
                    $sn = $this->db->prepare('SELECT name FROM subjects WHERE id = ?');
                    $sn->execute([$subjectId]);
                    $snRow = $sn->fetch();
                    if ($snRow) $subjectName = $snRow['name'];
                }

                $grade = $this->calcGrade((int)$item['obtained'], (int)($item['total_marks'] ?? 100));
                $stmt->execute([
                    $item['student_id'], $item['exam_id'],
                    $subjectId, $subjectName,
                    $item['total_marks'] ?? 100, $item['obtained'], $grade,
                    $sessionId, $status,
                ]);
            }

            if ($isAdmin && $examId) {
                $examCheck = $this->db->prepare("SELECT is_annual, class_id FROM exams WHERE id = ?");
                $examCheck->execute([$examId]);
                $exam = $examCheck->fetch();
                if ($exam && $exam['is_annual'] == 1) $this->calculateRankings($examId, $exam['class_id']);
            }

            $this->db->commit();
            Response::success(null, $isAdmin ? 'Marks saved' : 'Marks saved as pending');
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Error in bulkStore: " . $e->getMessage());
            Response::error('Failed to save marks: ' . $e->getMessage(), 500);
        }
    }

    // GET /results/pending?exam_id=X&class=Y  — class teacher sees pending marks for their class
    public function pendingMarks(): void {
        Auth::requireRole('admin', 'class_teacher');
        $examId    = $_GET['exam_id'] ?? '';
        $className = $_GET['class']   ?? '';
        if (!$examId) Response::error('exam_id required');

        $where  = "r.exam_id = ? AND r.status IN ('pending','submitted')";
        $params = [$examId];
        if ($className) {
            $where  .= " AND c.name = ?";
            $params[] = $className;
        }

        $stmt = $this->db->prepare("
            SELECT r.id, r.student_id, r.subject_name, r.obtained, r.total_marks, r.grade, r.status,
                   s.name AS student_name, s.roll, c.name AS class_name
            FROM results r
            JOIN students s ON s.id = r.student_id
            JOIN classes  c ON c.id = s.class_id
            WHERE $where
            ORDER BY s.roll, r.subject_name");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    // POST /results/submit  { exam_id, class }  — class teacher submits pending marks to admin
    public function submitMarks(): void {
        Auth::requireRole('class_teacher');
        $body      = json_decode(file_get_contents('php://input'), true);
        $examId    = $body['exam_id'] ?? '';
        $className = $body['class']   ?? '';
        if (!$examId || !$className) Response::error('exam_id and class required');

        $this->db->prepare("
            UPDATE results r
            JOIN students s ON s.id = r.student_id
            JOIN classes  c ON c.id = s.class_id
            SET r.status = 'submitted'
            WHERE r.exam_id = ? AND c.name = ? AND r.status = 'pending'
        ")->execute([$examId, $className]);

        Response::success(null, 'Marks submitted to admin');
    }

    // POST /results/publish  { exam_id, class? }  — admin publishes submitted marks
    public function publishMarks(): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $examId    = $body['exam_id'] ?? '';
        $className = $body['class']   ?? '';
        if (!$examId) Response::error('exam_id required');

        if ($className) {
            $this->db->prepare("
                UPDATE results r
                JOIN students s ON s.id = r.student_id
                JOIN classes  c ON c.id = s.class_id
                SET r.status = 'published'
                WHERE r.exam_id = ? AND c.name = ? AND r.status = 'submitted'
            ")->execute([$examId, $className]);
        } else {
            $this->db->prepare("
                UPDATE results SET status = 'published'
                WHERE exam_id = ? AND status = 'submitted'
            ")->execute([$examId]);
        }

        // Recalculate rankings
        $examCheck = $this->db->prepare("SELECT is_annual, class_id FROM exams WHERE id = ?");
        $examCheck->execute([$examId]);
        $exam = $examCheck->fetch();
        if ($exam && $exam['is_annual'] == 1) $this->calculateRankings($examId, $exam['class_id']);

        Response::success(null, 'Results published');
    }
    
    // Calculate rankings for annual exam
    private function calculateRankings(string $examId, ?int $classId): void {
        // Get exam pass mark percentage
        $examStmt = $this->db->prepare("SELECT pass_mark_percent FROM exams WHERE id = ?");
        $examStmt->execute([$examId]);
        $exam = $examStmt->fetch();
        $passMarkPercent = $exam ? (int)$exam['pass_mark_percent'] : 33;
        
        // Get all students' results with passed subjects count
        $query = "
            SELECT r.student_id, 
                   SUM(r.obtained) as total_obtained,
                   SUM(r.total_marks) as total_marks,
                   COUNT(r.id) as subjects_total,
                   SUM(CASE WHEN (r.obtained / r.total_marks * 100) >= ? THEN 1 ELSE 0 END) as subjects_passed,
                   (COUNT(r.id) - SUM(CASE WHEN (r.obtained / r.total_marks * 100) >= ? THEN 1 ELSE 0 END)) as subjects_failed
            FROM results r
            JOIN students s ON s.id = r.student_id
            WHERE r.exam_id = ?
        ";
        
        if ($classId) {
            $query .= " AND s.class_id = ?";
        }
        
        // Sort by: 1) subjects_failed ASC (fewer failures = better rank), 2) total_obtained DESC (higher marks = better rank)
        $query .= " GROUP BY r.student_id ORDER BY subjects_failed ASC, total_obtained DESC";
        
        $stmt = $this->db->prepare($query);
        if ($classId) {
            $stmt->execute([$passMarkPercent, $passMarkPercent, $examId, $classId]);
        } else {
            $stmt->execute([$passMarkPercent, $passMarkPercent, $examId]);
        }
        
        $students = $stmt->fetchAll();
        
        // Assign rankings
        $rank = 1;
        foreach ($students as $student) {
            // Store ranking in a separate table or update student record
            // For now, we'll just ensure the ranking is calculated during promotion
            // The actual ranking assignment happens in the promotion process
        }
    }

    public function byExam(string $examId): void {
        Auth::require();
        
        // Get exam pass mark percentage
        $examStmt = $this->db->prepare("SELECT pass_mark_percent FROM exams WHERE id = ?");
        $examStmt->execute([$examId]);
        $exam = $examStmt->fetch();
        $passMarkPercent = $exam ? (int)$exam['pass_mark_percent'] : 33;
        
        $stmt = $this->db->prepare("
            SELECT r.*, s.name AS student_name, s.roll, c.name AS class, sub.name AS subject_name
            FROM results r
            JOIN students s   ON s.id  = r.student_id
            JOIN classes  c   ON c.id  = s.class_id
            JOIN subjects sub ON sub.id = r.subject_id
            WHERE r.exam_id = ?
            ORDER BY s.roll, sub.name");
        $stmt->execute([$examId]);
        $rows = $stmt->fetchAll();

        // group by student
        $grouped = [];
        foreach ($rows as $row) {
            $sid = $row['student_id'];
            if (!isset($grouped[$sid])) {
                $grouped[$sid] = [
                    'student_id'   => $sid,
                    'student_name' => $row['student_name'],
                    'roll'         => $row['roll'],
                    'class'        => $row['class'],
                    'subjects'     => [],
                    'total_marks'  => 0,
                    'total_obtained' => 0,
                    'subjects_passed' => 0,
                    'subjects_total' => 0,
                ];
            }
            $grouped[$sid]['subjects'][]      = $row;
            $grouped[$sid]['total_marks']    += (int)$row['total_marks'];
            $grouped[$sid]['total_obtained'] += (int)$row['obtained'];
            $grouped[$sid]['subjects_total']++;
            
            // Check if this subject is passed
            $subjectPercent = $row['total_marks'] > 0 
                ? ($row['obtained'] / $row['total_marks'] * 100) 
                : 0;
            if ($subjectPercent >= $passMarkPercent) {
                $grouped[$sid]['subjects_passed']++;
            }
        }
        
        foreach ($grouped as &$g) {
            $g['percentage'] = $g['total_marks'] > 0
                ? round($g['total_obtained'] / $g['total_marks'] * 100, 2) : 0;
            // Calculate number of failed subjects
            $g['subjects_failed'] = $g['subjects_total'] - $g['subjects_passed'];
            $g['passed_all'] = $g['subjects_failed'] == 0;
        }
        
        // RANKING LOGIC:
        // 1st Priority: Passed subjects count (more passed = better rank)
        //               Implemented as: fewer failed subjects = better rank
        // 2nd Priority: Total marks (higher marks = better rank)
        $results = array_values($grouped);
        usort($results, function($a, $b) {
            // First priority: subjects_failed ASC (fewer failures = more passes = better rank)
            if ($a['subjects_failed'] != $b['subjects_failed']) {
                return $a['subjects_failed'] - $b['subjects_failed'];
            }
            // Second priority: total_obtained DESC (higher marks = better rank)
            return $b['total_obtained'] - $a['total_obtained'];
        });
        
        // Assign rankings
        $rank = 1;
        foreach ($results as &$result) {
            $result['rank'] = $rank++;
        }
        
        Response::success($results);
    }

    public function myResults(): void {
        $user = Auth::requireRole('student');
        $s = $this->db->prepare('SELECT id FROM students WHERE user_id = ?');
        $s->execute([$user['id']]);
        $row = $s->fetch();
        if (!$row) Response::error('Student not found', 404);

        $stmt = $this->db->prepare("
            SELECT r.*, e.name AS exam_name, sub.name AS subject_name
            FROM results r
            JOIN exams    e   ON e.id   = r.exam_id
            JOIN subjects sub ON sub.id = r.subject_id
            WHERE r.student_id = ?
            ORDER BY e.start_date DESC, sub.name");
        $stmt->execute([$row['id']]);
        $rows = $stmt->fetchAll();

        // group by exam
        $grouped = [];
        foreach ($rows as $r) {
            $eid = $r['exam_id'];
            if (!isset($grouped[$eid])) {
                $grouped[$eid] = [
                    'exam_id'        => $eid,
                    'exam_name'      => $r['exam_name'],
                    'subjects'       => [],
                    'total_marks'    => 0,
                    'total_obtained' => 0,
                ];
            }
            $grouped[$eid]['subjects'][]      = $r;
            $grouped[$eid]['total_marks']    += (int)$r['total_marks'];
            $grouped[$eid]['total_obtained'] += (int)$r['obtained'];
        }
        foreach ($grouped as &$g) {
            $g['percentage'] = $g['total_marks'] > 0
                ? round($g['total_obtained'] / $g['total_marks'] * 100, 2) : 0;
        }
        Response::success(array_values($grouped));
    }

    // Public result check — by student ID only, no login required
    public function check(): void {
        $studentId = $_GET['studentId'] ?? $_GET['student_id'] ?? '';
        if (!$studentId) Response::error('studentId required');
        
        $sessionId = $_GET['session_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        $examId = $_GET['exam_id'] ?? null;

        $where = ['r.student_id = ?'];
        $params = [$studentId];
        
        if ($sessionId) {
            $where[] = 'r.session_id = ?';
            $params[] = $sessionId;
        }
        
        if ($classId) {
            $where[] = 's.class_id = ?';
            $params[] = $classId;
        }
        
        if ($examId) {
            $where[] = 'r.exam_id = ?';
            $params[] = $examId;
        }

        $stmt = $this->db->prepare("
            SELECT r.*, sub.name AS subject_name, e.name AS exam_name, e.id AS exam_id,
                   e.pass_mark_percent,
                   s.name AS student_name, c.name AS class_name,
                   sess.name AS session_name, sess.year AS session_year
            FROM results r
            JOIN subjects sub ON sub.id  = r.subject_id
            JOIN exams    e   ON e.id    = r.exam_id
            JOIN students s   ON s.id    = r.student_id
            JOIN classes  c   ON c.id    = s.class_id
            LEFT JOIN academic_sessions sess ON sess.id = r.session_id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY sess.year DESC, e.start_date DESC, sub.name");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        if (!$rows) Response::error('No results found', 404);

        // group by exam
        $grouped = [];
        $studentName = $rows[0]['student_name'];
        $className   = $rows[0]['class_name'];
        
        foreach ($rows as $r) {
            $eid = $r['exam_id'];
            if (!isset($grouped[$eid])) {
                $grouped[$eid] = [
                    'exam_id'        => $eid,
                    'exam_name'      => $r['exam_name'],
                    'session_name'   => $r['session_name'],
                    'session_year'   => $r['session_year'],
                    'pass_mark_percent' => (int)$r['pass_mark_percent'],
                    'subjects'       => [],
                    'total_marks'    => 0,
                    'total_obtained' => 0,
                    'subjects_passed' => 0,
                    'subjects_total' => 0,
                ];
            }
            $grouped[$eid]['subjects'][]      = $r;
            $grouped[$eid]['total_marks']    += (int)$r['total_marks'];
            $grouped[$eid]['total_obtained'] += (int)$r['obtained'];
            $grouped[$eid]['subjects_total']++;
            
            // Check if subject passed
            $subjectPercent = $r['total_marks'] > 0 
                ? ($r['obtained'] / $r['total_marks'] * 100) 
                : 0;
            if ($subjectPercent >= $grouped[$eid]['pass_mark_percent']) {
                $grouped[$eid]['subjects_passed']++;
            }
        }
        
        foreach ($grouped as &$g) {
            $g['percentage'] = $g['total_marks'] > 0
                ? round($g['total_obtained'] / $g['total_marks'] * 100, 2) : 0;
            $g['subjects_failed'] = $g['subjects_total'] - $g['subjects_passed'];
            $g['passed_all'] = $g['subjects_failed'] == 0;
        }
        
        // Calculate rankings for each exam
        foreach ($grouped as $examId => &$examData) {
            // Get all students' results for this exam to calculate ranking
            // RANKING LOGIC: 1) Fewer failed subjects = better rank, 2) Higher total marks = better rank
            $allResults = $this->db->prepare("
                SELECT r.student_id,
                       SUM(r.obtained) as total_obtained,
                       SUM(r.total_marks) as total_marks,
                       COUNT(r.id) as subjects_total,
                       SUM(CASE WHEN (r.obtained / r.total_marks * 100) >= ? THEN 1 ELSE 0 END) as subjects_passed,
                       (COUNT(r.id) - SUM(CASE WHEN (r.obtained / r.total_marks * 100) >= ? THEN 1 ELSE 0 END)) as subjects_failed
                FROM results r
                WHERE r.exam_id = ?
                GROUP BY r.student_id
                ORDER BY 
                    subjects_failed ASC,
                    SUM(r.obtained) DESC
            ");
            $allResults->execute([$examData['pass_mark_percent'], $examData['pass_mark_percent'], $examId]);
            $allStudents = $allResults->fetchAll();
            
            // Find this student's rank
            $rank = 1;
            $found = false;
            foreach ($allStudents as $student) {
                if ($student['student_id'] == $studentId) {
                    $examData['rank'] = $rank;
                    $found = true;
                    break;
                }
                $rank++;
            }
            
            // If not found, set rank to null
            if (!$found) {
                $examData['rank'] = null;
            }
            
            $examData['total_students'] = count($allStudents);
        }

        Response::success([
            'student_id'   => $studentId,
            'student_name' => $studentName,
            'class_name'   => $className,
            'exams'        => array_values($grouped),
        ]);
    }
}
