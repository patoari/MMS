<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class StudentWritingController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query(
            "SELECT * FROM student_writings WHERE is_active = 1 ORDER BY sort_order ASC, id DESC"
        );
        Response::success($stmt->fetchAll());
    }

    public function all(): void {
        Auth::requireRole('admin');
        $stmt = $this->db->query("SELECT * FROM student_writings ORDER BY sort_order ASC, id DESC");
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);
        if (empty($b['title']) || empty($b['content'])) Response::error('title and content required', 422);
        $max = $this->db->query("SELECT COALESCE(MAX(sort_order),0) FROM student_writings")->fetchColumn();
        $this->db->prepare(
            "INSERT INTO student_writings (title, content, author, type, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([
            $b['title'], $b['content'],
            $b['author']     ?? '',
            $b['type']       ?? 'প্রবন্ধ',
            (int)($b['sort_order'] ?? $max + 1),
            isset($b['is_active']) ? (int)$b['is_active'] : 1,
        ]);
        Response::success(['id' => (int)$this->db->lastInsertId()], 'Added', 201);
    }

    public function update(int $id): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);
        $fields = []; $params = [];
        foreach (['title','content','author','type','sort_order','is_active'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $params[] = in_array($f, ['sort_order','is_active']) ? (int)$b[$f] : $b[$f];
            }
        }
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id;
        $this->db->prepare("UPDATE student_writings SET " . implode(', ', $fields) . " WHERE id = ?")
                 ->execute($params);
        Response::success(null, 'Updated');
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("DELETE FROM student_writings WHERE id = ?")->execute([$id]);
        Response::success(null, 'Deleted');
    }
}
