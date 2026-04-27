<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SiteFeaturesController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    // GET /api/site-features — public
    public function index(): void {
        $stmt = $this->db->query(
            "SELECT id, icon, title, description, sort_order, is_active
             FROM site_features
             ORDER BY sort_order ASC"
        );
        Response::success($stmt->fetchAll());
    }

    // POST /api/site-features — admin only
    public function store(): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);

        if (empty($b['title']) || empty($b['description'])) {
            Response::error('title এবং description আবশ্যক', 422);
        }

        $stmt = $this->db->prepare(
            "INSERT INTO site_features (icon, title, description, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $b['icon']        ?? '',
            $b['title'],
            $b['description'],
            (int)($b['sort_order'] ?? 0),
            isset($b['is_active']) ? (int)$b['is_active'] : 1,
        ]);
        $id = (int)$this->db->lastInsertId();
        Response::success(['id' => $id], 'Feature added', 201);
    }

    // PUT /api/site-features/{id} — admin only
    public function update(int $id): void {
        Auth::requireRole('admin');
        $b = json_decode(file_get_contents('php://input'), true);

        $fields = [];
        $params = [];

        if (isset($b['icon']))        { $fields[] = 'icon = ?';        $params[] = $b['icon']; }
        if (isset($b['title']))       { $fields[] = 'title = ?';       $params[] = $b['title']; }
        if (isset($b['description'])) { $fields[] = 'description = ?'; $params[] = $b['description']; }
        if (isset($b['sort_order']))  { $fields[] = 'sort_order = ?';  $params[] = (int)$b['sort_order']; }
        if (isset($b['is_active']))   { $fields[] = 'is_active = ?';   $params[] = (int)$b['is_active']; }

        if (empty($fields)) Response::error('কোনো ফিল্ড পাওয়া যায়নি', 422);

        $params[] = $id;
        $this->db->prepare("UPDATE site_features SET " . implode(', ', $fields) . " WHERE id = ?")
                 ->execute($params);

        Response::success(null, 'Feature updated');
    }

    // DELETE /api/site-features/{id} — admin only
    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("DELETE FROM site_features WHERE id = ?")->execute([$id]);
        Response::success(null, 'Feature deleted');
    }
}
