<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class ClassController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query("
            SELECT c.*, GROUP_CONCAT(cs.name ORDER BY cs.sort_order SEPARATOR ',') AS sections
            FROM classes c
            LEFT JOIN class_sections cs ON cs.class_id = c.id
            GROUP BY c.id
            ORDER BY c.sort_order, c.id");
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['sections'] = $r['sections'] ? explode(',', $r['sections']) : [];
        }
        Response::success($rows);
    }

    public function store(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $name = trim($body['name'] ?? '');
        if (!$name) Response::error('Class name required');

        $check = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $check->execute([$name]);
        if ($check->fetch()) Response::error('এই নামে শ্রেণি ইতিমধ্যে আছে।', 409);

        $maxSort = $this->db->query('SELECT COALESCE(MAX(sort_order),0) FROM classes')->fetchColumn();
        $this->db->prepare('INSERT INTO classes (name, sort_order) VALUES (?, ?)')->execute([$name, $maxSort + 1]);
        $id = (int)$this->db->lastInsertId();

        // Also create fee_settings row for this class
        $this->db->prepare('INSERT IGNORE INTO fee_settings (class_id) VALUES (?)')->execute([$id]);

        Response::success(['id' => $id, 'name' => $name, 'sections' => []], 'Class created', 201);
    }

    public function update(int $id): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        $name = trim($body['name'] ?? '');
        if (!$name) Response::error('Class name required');

        $check = $this->db->prepare('SELECT id FROM classes WHERE name = ? AND id != ?');
        $check->execute([$name, $id]);
        if ($check->fetch()) Response::error('এই নামে শ্রেণি ইতিমধ্যে আছে।', 409);

        $this->db->prepare('UPDATE classes SET name = ? WHERE id = ?')->execute([$name, $id]);
        Response::success(null, 'Updated');
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        // Check if any students are enrolled
        $count = $this->db->prepare('SELECT COUNT(*) FROM students WHERE class_id = ?');
        $count->execute([$id]);
        if ((int)$count->fetchColumn() > 0)
            Response::error('এই শ্রেণিতে শিক্ষার্থী আছে। আগে শিক্ষার্থীদের অন্য শ্রেণিতে স্থানান্তর করুন।', 409);

        $this->db->prepare('DELETE FROM class_sections WHERE class_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM class_subjects WHERE class_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM fee_settings WHERE class_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM classes WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }

    // Sections
    public function storeSections(int $classId): void {
        Auth::requireRole('admin');
        $body     = json_decode(file_get_contents('php://input'), true);
        $sections = array_filter(array_map('trim', $body['sections'] ?? []), fn($s) => $s !== '');

        $this->db->prepare('DELETE FROM class_sections WHERE class_id = ?')->execute([$classId]);
        $stmt = $this->db->prepare('INSERT INTO class_sections (class_id, name, sort_order) VALUES (?, ?, ?)');
        foreach (array_values($sections) as $i => $name) {
            $stmt->execute([$classId, $name, $i]);
        }
        Response::success(null, 'Sections updated');
    }

    public function subjects(): void {
        $stmt = $this->db->query("SELECT * FROM subjects ORDER BY id");
        Response::success($stmt->fetchAll());
    }
}
