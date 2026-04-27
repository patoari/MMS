<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../middleware/Auth.php';

class HomepageTeacherController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query(
            "SELECT ht.id, COALESCE(t.name, ht.name) AS name, ht.teacher_id,
                    ht.designation, ht.subject, ht.bio, ht.photo, ht.sort_order, ht.is_active
             FROM homepage_teachers ht
             LEFT JOIN teachers t ON t.id = ht.teacher_id
             ORDER BY ht.sort_order ASC, ht.id ASC"
        );
        $items = $stmt->fetchAll();
        
        // Transform photo paths to full URLs
        $items = array_map(function($item) {
            if ($item['photo'] && !filter_var($item['photo'], FILTER_VALIDATE_URL)) {
                $item['photo'] = UPLOAD_URL . $item['photo'];
            }
            return $item;
        }, $items);
        
        Response::success($items);
    }

    public function store(): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);
        if (empty($b['name'])) Response::error('name আবশ্যক', 422);

        $max = $this->db->query("SELECT COALESCE(MAX(sort_order),0) FROM homepage_teachers")->fetchColumn();
        $this->db->prepare(
            "INSERT INTO homepage_teachers (name, designation, subject, bio, photo, sort_order, is_active, teacher_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $b['name'],
            $b['designation'] ?? '',
            $b['subject']     ?? '',
            $b['bio']         ?? '',
            $b['photo']       ?? '',
            (int)($b['sort_order'] ?? $max + 1),
            isset($b['is_active']) ? (int)$b['is_active'] : 1,
            $b['teacher_id']  ?? null,
        ]);
        Response::success(['id' => (int)$this->db->lastInsertId()], 'Added', 201);
    }

    public function update(int $id): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);
        $fields = []; $params = [];
        foreach (['name','designation','subject','bio','photo','sort_order','is_active'] as $f) {
            if (array_key_exists($f, $b)) {
                $fields[] = "$f = ?";
                $params[] = in_array($f, ['sort_order','is_active']) ? (int)$b[$f] : $b[$f];
            }
        }
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id;
        $this->db->prepare("UPDATE homepage_teachers SET " . implode(', ', $fields) . " WHERE id = ?")
                 ->execute($params);
        Response::success(null, 'Updated');
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("DELETE FROM homepage_teachers WHERE id = ?")->execute([$id]);
        Response::success(null, 'Deleted');
    }

    public function uploadPhoto(): void {
        Auth::requireRole('admin');
        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK)
            Response::error('No file uploaded');

        try {
            $relativePath = FileUpload::uploadImage($_FILES['photo'], 'teachers', 'ht_');
            $url = FileUpload::getUrl($relativePath);
            Response::success(['url' => $url], 'Uploaded', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
