<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class RoutineController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function getCurrentSessionId(): ?int {
        $r = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1")->fetch();
        return $r ? (int)$r['id'] : null;
    }

    private function resolveSessionId(?string $param): ?int {
        if ($param) return (int)$param;
        return $this->getCurrentSessionId();
    }

    // ── Class Routine ─────────────────────────────────────────────────────────

    // GET /class-routine?class=X&session_id=Y&published=1
    public function classRoutine(): void {
        $className  = $_GET['class']      ?? '';
        $sessionId  = $this->resolveSessionId($_GET['session_id'] ?? null);
        $pubOnly    = isset($_GET['published']) ? (bool)$_GET['published'] : true;

        if (!$className) Response::error('class parameter required');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::success(['columns' => [], 'rows' => [], 'published' => false]);
        $classId = $clsRow['id'];

        // Build column query
        $colWhere = 'class_id = ?';
        $colParams = [$classId];
        if ($sessionId) { $colWhere .= ' AND session_id = ?'; $colParams[] = $sessionId; }
        if ($pubOnly)   { $colWhere .= ' AND published = 1'; }

        $colStmt = $this->db->prepare(
            "SELECT id, label, time_slot AS time, is_leisure AS leisure, sort_order, published, session_id
             FROM class_routine_columns WHERE $colWhere ORDER BY sort_order LIMIT 1");
        $colStmt->execute($colParams);
        $firstCol = $colStmt->fetch();

        // If no published routine found, return empty
        if (!$firstCol) {
            Response::success(['columns' => [], 'rows' => [], 'published' => false]);
        }

        // Fetch all columns for this session
        $allColStmt = $this->db->prepare(
            "SELECT id, label, time_slot AS time, is_leisure AS leisure, sort_order, published
             FROM class_routine_columns WHERE class_id = ? AND session_id = ? ORDER BY sort_order");
        $allColStmt->execute([$classId, $firstCol['session_id']]);
        $columns = $allColStmt->fetchAll();
        foreach ($columns as &$c) { $c['leisure'] = (bool)$c['leisure']; }

        // Cells
        $colIds = array_column($columns, 'id');
        $cells = [];
        if ($colIds) {
            $ph = implode(',', array_fill(0, count($colIds), '?'));
            $cellStmt = $this->db->prepare(
                "SELECT col_id, row_day AS day, subject, teacher FROM class_routine_cells WHERE col_id IN ($ph)");
            $cellStmt->execute($colIds);
            $cells = $cellStmt->fetchAll();
        }

        $days = ['শনিবার','রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার'];
        $cellMap = [];
        foreach ($cells as $cell) {
            $cellMap[$cell['day']][$cell['col_id']] = ['subject' => $cell['subject'], 'teacher' => $cell['teacher']];
        }
        $rows = [];
        foreach ($days as $day) {
            $rows[] = ['id' => $day, 'day' => $day, 'cells' => (object)($cellMap[$day] ?? [])];
        }

        Response::success(['columns' => $columns, 'rows' => $rows, 'published' => (bool)$firstCol['published']]);
    }

    // POST /class-routine  { class, session_id?, columns, rows }
    // Saves as draft (published=0). Does NOT auto-publish.
    public function storeClassRoutine(): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $className = $body['class']      ?? '';
        $columns   = $body['columns']    ?? [];
        $rows      = $body['rows']       ?? [];
        $sessionId = $this->resolveSessionId($body['session_id'] ?? null);

        if (!$className) Response::error('class required');
        if (!$sessionId) Response::error('No active session found');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::error('Class not found', 404);
        $classId = $clsRow['id'];

        $this->db->beginTransaction();

        // Delete old columns for this class+session (full replace)
        $this->db->prepare(
            "DELETE FROM class_routine_columns WHERE class_id = ? AND session_id = ?"
        )->execute([$classId, $sessionId]);

        // Insert columns (draft: published=0)
        $colSql = 'INSERT INTO class_routine_columns (id, class_id, session_id, label, time_slot, is_leisure, sort_order, published)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)';
        $colStmt = $this->db->prepare($colSql);
        foreach ($columns as $i => $col) {
            $colStmt->execute([
                $col['id'], $classId, $sessionId, $col['label'],
                $col['time'] ?? null, (int)($col['leisure'] ?? 0), $i,
            ]);
        }

        // Delete old cells for this class+session columns, then re-insert
        $colIds = array_column($columns, 'id');
        if ($colIds) {
            $ph = implode(',', array_fill(0, count($colIds), '?'));
            $this->db->prepare("DELETE FROM class_routine_cells WHERE col_id IN ($ph)")->execute($colIds);
        }

        $cellSql = 'INSERT INTO class_routine_cells (class_id, col_id, row_day, subject, teacher) VALUES (?, ?, ?, ?, ?)';
        $cellStmt = $this->db->prepare($cellSql);
        foreach ($rows as $row) {
            $day = $row['day'] ?? '';
            foreach (($row['cells'] ?? []) as $colId => $cellData) {
                if (is_string($cellData)) { $subject = $cellData; $teacher = null; }
                else { $subject = $cellData['subject'] ?? ''; $teacher = $cellData['teacher'] ?? null; }
                $cellStmt->execute([$classId, $colId, $day, $subject, $teacher]);
            }
        }

        $this->db->commit();
        Response::success(null, 'Class routine saved as draft');
    }

    // POST /class-routine/publish  { session_id? }
    // Publishes ALL class routines for a session (sets published=1)
    public function publishClassRoutine(): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $sessionId = $this->resolveSessionId($body['session_id'] ?? null);
        if (!$sessionId) Response::error('No active session found');

        $this->db->prepare(
            "UPDATE class_routine_columns SET published = 1 WHERE session_id = ?"
        )->execute([$sessionId]);

        // Auto-generate a single combined notice for all classes
        $this->autoNoticeAllClassRoutines($sessionId);

        Response::success(null, 'All class routines published');
    }

    // ── Exam Routine ──────────────────────────────────────────────────────────

    // GET /exam-routine?class=X&session_id=Y&exam_id=Z&published=1
    public function examRoutine(): void {
        $className = $_GET['class']      ?? '';
        $sessionId = $this->resolveSessionId($_GET['session_id'] ?? null);
        $examId    = $_GET['exam_id']    ?? null;
        $pubOnly   = isset($_GET['published']) ? (bool)$_GET['published'] : true;

        if (!$className) Response::error('class parameter required');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::success(['columns' => [], 'rows' => [], 'published' => false]);
        $classId = $clsRow['id'];

        // Find columns
        $colWhere  = 'class_id = ?';
        $colParams = [$classId];
        if ($sessionId) { $colWhere .= ' AND session_id = ?'; $colParams[] = $sessionId; }
        if ($examId)    { $colWhere .= ' AND exam_id = ?';    $colParams[] = $examId; }
        if ($pubOnly)   { $colWhere .= ' AND published = 1'; }

        $colStmt = $this->db->prepare(
            "SELECT id, label, exam_col_type AS examColType, sort_order, published, session_id, exam_id
             FROM exam_routine_columns WHERE $colWhere ORDER BY sort_order");
        $colStmt->execute($colParams);
        $columns = $colStmt->fetchAll();

        if (!$columns) {
            Response::success(['columns' => [], 'rows' => [], 'published' => false]);
        }

        $firstCol  = $columns[0];
        $useSession = $firstCol['session_id'];
        $useExam    = $firstCol['exam_id'];

        // Rows for this session+exam
        $rowWhere  = 'class_id = ?';
        $rowParams = [$classId];
        if ($useSession) { $rowWhere .= ' AND session_id = ?'; $rowParams[] = $useSession; }
        if ($useExam)    { $rowWhere .= ' AND exam_id = ?';    $rowParams[] = $useExam; }

        $rowStmt = $this->db->prepare(
            "SELECT er.id, er.sort_order, erc.col_id, erc.value
             FROM exam_routine_rows er
             LEFT JOIN exam_routine_cells erc ON erc.row_id = er.id
             WHERE er.$rowWhere
             ORDER BY er.sort_order");
        $rowStmt->execute($rowParams);
        $rawRows = $rowStmt->fetchAll();

        $rowMap = [];
        foreach ($rawRows as $r) {
            if (!isset($rowMap[$r['id']])) {
                $rowMap[$r['id']] = ['id' => $r['id'], 'sort_order' => $r['sort_order'], 'cells' => []];
            }
            if ($r['col_id']) $rowMap[$r['id']]['cells'][$r['col_id']] = $r['value'];
        }

        Response::success([
            'columns'   => $columns,
            'rows'      => array_values($rowMap),
            'published' => (bool)$firstCol['published'],
        ]);
    }

    // POST /exam-routine  { class, session_id?, exam_id?, columns, rows }
    // Saves as draft (published=0).
    public function storeExamRoutine(): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $className = $body['class']      ?? '';
        $columns   = $body['columns']    ?? [];
        $rows      = $body['rows']       ?? [];
        $sessionId = $this->resolveSessionId($body['session_id'] ?? null);
        $examId    = $body['exam_id']    ?? null;

        if (!$className) Response::error('class required');
        if (!$sessionId) Response::error('No active session found');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::error('Class not found', 404);
        $classId = $clsRow['id'];

        $this->db->beginTransaction();

        // Delete old columns for this class+session+exam
        $delColWhere  = 'class_id = ? AND session_id = ?';
        $delColParams = [$classId, $sessionId];
        if ($examId) { $delColWhere .= ' AND exam_id = ?'; $delColParams[] = $examId; }
        $this->db->prepare("DELETE FROM exam_routine_columns WHERE $delColWhere")->execute($delColParams);

        // Insert columns (draft)
        $colSql = 'INSERT INTO exam_routine_columns (id, class_id, session_id, exam_id, label, exam_col_type, sort_order, published)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)';
        $colStmt = $this->db->prepare($colSql);
        foreach ($columns as $i => $col) {
            $colStmt->execute([$col['id'], $classId, $sessionId, $examId, $col['label'], $col['examColType'] ?? null, $i]);
        }

        // Delete old rows for this class+session+exam
        $delRowWhere  = 'class_id = ? AND session_id = ?';
        $delRowParams = [$classId, $sessionId];
        if ($examId) { $delRowWhere .= ' AND exam_id = ?'; $delRowParams[] = $examId; }
        // Get row ids first to cascade-delete cells
        $oldRows = $this->db->prepare("SELECT id FROM exam_routine_rows WHERE $delRowWhere");
        $oldRows->execute($delRowParams);
        $oldRowIds = array_column($oldRows->fetchAll(), 'id');
        if ($oldRowIds) {
            $ph = implode(',', array_fill(0, count($oldRowIds), '?'));
            $this->db->prepare("DELETE FROM exam_routine_cells WHERE row_id IN ($ph)")->execute($oldRowIds);
        }
        $this->db->prepare("DELETE FROM exam_routine_rows WHERE $delRowWhere")->execute($delRowParams);

        // Insert rows + cells
        $rowSql  = 'INSERT INTO exam_routine_rows (id, class_id, session_id, exam_id, sort_order) VALUES (?, ?, ?, ?, ?)';
        $rowStmt = $this->db->prepare($rowSql);
        $cellSql = 'INSERT INTO exam_routine_cells (row_id, col_id, value) VALUES (?, ?, ?)';
        $cellStmt = $this->db->prepare($cellSql);

        foreach ($rows as $i => $row) {
            $rowStmt->execute([$row['id'], $classId, $sessionId, $examId, $i]);
            foreach (($row['cells'] ?? []) as $colId => $cellData) {
                $value = is_array($cellData) ? ($cellData['value'] ?? $cellData['subject'] ?? '') : (string)$cellData;
                $cellStmt->execute([$row['id'], $colId, $value]);
            }
        }

        $this->db->commit();
        Response::success(null, 'Exam routine saved as draft');
    }

    // POST /exam-routine/publish  { session_id?, exam_id? }
    // Publishes ALL exam routines for a session (optionally filtered by exam)
    public function publishExamRoutine(): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $sessionId = $this->resolveSessionId($body['session_id'] ?? null);
        $examId    = $body['exam_id'] ?? null;
        if (!$sessionId) Response::error('No active session found');

        $where  = 'session_id = ?';
        $params = [$sessionId];
        if ($examId) { $where .= ' AND exam_id = ?'; $params[] = $examId; }

        $this->db->prepare("UPDATE exam_routine_columns SET published = 1 WHERE $where")->execute($params);

        // Auto-generate a single notice for this exam's routine
        $this->autoNoticeRoutine('exam', 'সকল শ্রেণির', $sessionId, $examId);

        Response::success(null, 'Exam routines published');
    }

    // GET /class-routine/teacher-subjects?class=X&session_id=Y&teacher=Z
    // Returns distinct subjects taught by a teacher in a class routine
    public function teacherSubjects(): void {
        Auth::require();
        $className = $_GET['class']   ?? '';
        $teacher   = $_GET['teacher'] ?? '';
        $sessionId = $this->resolveSessionId($_GET['session_id'] ?? null);

        if (!$className || !$teacher) Response::error('class and teacher required');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$className]);
        $clsRow = $cls->fetch();
        if (!$clsRow) Response::success([]);
        $classId = $clsRow['id'];

        // Get column ids for this class+session
        $colStmt = $this->db->prepare(
            "SELECT id FROM class_routine_columns WHERE class_id = ? AND session_id = ?"
        );
        $colStmt->execute([$classId, $sessionId]);
        $colIds = array_column($colStmt->fetchAll(), 'id');

        if (!$colIds) Response::success([]);

        $ph = implode(',', array_fill(0, count($colIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT DISTINCT subject FROM class_routine_cells
             WHERE col_id IN ($ph) AND teacher = ? AND subject != '' AND subject IS NOT NULL"
        );
        $stmt->execute(array_merge($colIds, [$teacher]));
        $subjects = array_column($stmt->fetchAll(), 'subject');

        Response::success($subjects);
    }
    public function listExamRoutines(): void {
        $sessionId = $this->resolveSessionId($_GET['session_id'] ?? null);
        $where = '1=1'; $params = [];
        if ($sessionId) { $where .= ' AND erc.session_id = ?'; $params[] = $sessionId; }

        $stmt = $this->db->prepare(
            "SELECT DISTINCT erc.exam_id, e.name AS exam_name
             FROM exam_routine_columns erc
             LEFT JOIN exams e ON e.id = erc.exam_id
             WHERE $where"
        );
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    // ── Auto-generate a single notice for all class routines ─────────────────
    private function autoNoticeAllClassRoutines(int $sessionId): void {
        $user = Auth::user();
        $createdBy = $user['id'] ?? null;

        $sess = $this->db->prepare("SELECT name FROM academic_sessions WHERE id = ?");
        $sess->execute([$sessionId]);
        $sessName = $sess->fetchColumn() ?: '';

        $title = 'ক্লাস রুটিন প্রকাশিত হয়েছে (' . $sessName . ')';
        $body  = $sessName . ' সেশনের সকল শ্রেণির সাপ্তাহিক ক্লাস রুটিন প্রকাশিত হয়েছে। [[link:/class-routine|ক্লাস রুটিন দেখুন]]';

        // Replace any previous auto-notice for this session's class routine
        $this->db->prepare("DELETE FROM notices WHERE title = ? AND category = 'রুটিন'")->execute([$title]);
        $this->db->prepare(
            "INSERT INTO notices (title, content, category, is_important, status, created_by) VALUES (?, ?, 'রুটিন', 1, 'draft', ?)"
        )->execute([$title, $body, $createdBy]);
    }

    // ── Auto-generate routine notice ─────────────────────────────────────────
    private function autoNoticeRoutine(string $type, string $className, int $sessionId, ?string $examId = null): void {
        $user = Auth::user();
        $createdBy = $user['id'] ?? null;

        // Get session name
        $sess = $this->db->prepare("SELECT name FROM academic_sessions WHERE id = ?");
        $sess->execute([$sessionId]);
        $sessName = $sess->fetchColumn() ?: '';

        if ($type === 'class') {
            $title    = $className . ' — ক্লাস রুটিন প্রকাশিত হয়েছে (' . $sessName . ')';
            $linkText = 'ক্লাস রুটিন দেখুন';
            $link     = '/class-routine';
            $body     = $className . ' শ্রেণির ' . $sessName . ' সেশনের সাপ্তাহিক ক্লাস রুটিন প্রকাশিত হয়েছে। [[link:' . $link . '|' . $linkText . ']]';
        } else {
            $examName = '';
            if ($examId) {
                $ex = $this->db->prepare("SELECT name FROM exams WHERE id = ?");
                $ex->execute([$examId]);
                $examName = $ex->fetchColumn() ?: '';
            }
            $title    = $className . ' — ' . ($examName ?: 'পরীক্ষার') . ' রুটিন প্রকাশিত হয়েছে (' . $sessName . ')';
            $linkText = 'পরীক্ষার রুটিন দেখুন';
            $link     = '/exam-routine';
            $body     = $className . ' শ্রেণির ' . ($examName ? $examName . ' পরীক্ষার' : 'পরীক্ষার') . ' রুটিন প্রকাশিত হয়েছে। [[link:' . $link . '|' . $linkText . ']]';
        }

        // Replace previous auto-notice for same title
        $this->db->prepare("DELETE FROM notices WHERE title = ? AND category = 'রুটিন'")->execute([$title]);
        $this->db->prepare(
            "INSERT INTO notices (title, content, category, is_important, status, created_by) VALUES (?, ?, 'রুটিন', 1, 'draft', ?)"
        )->execute([$title, $body, $createdBy]);
    }
}
