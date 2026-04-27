<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../middleware/Auth.php';

class HomepageGalleryController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query("SELECT * FROM homepage_gallery ORDER BY sort_order ASC, id DESC");
        $items = $stmt->fetchAll();
        
        // Transform image paths to full URLs
        $items = array_map(function($item) {
            $item['url'] = FileUpload::transformPhotoUrl($item['url']);
            return $item;
        }, $items);
        
        Response::success($items);
    }

    public function store(): void {
        Auth::requireRole('admin');

        if (!empty($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            try {
                $relativePath = FileUpload::uploadImage($_FILES['image'], 'homepage_gallery', 'hg_');
                $url = FileUpload::getUrl($relativePath);
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } else {
            $body = json_decode(file_get_contents('php://input'), true);
            $url  = trim($body['url'] ?? '');
            if (!$url) Response::error('image file or url required');
        }

        $caption = $_POST['caption'] ?? '';
        $max     = $this->db->query("SELECT COALESCE(MAX(sort_order),0) FROM homepage_gallery")->fetchColumn();
        $this->db->prepare("INSERT INTO homepage_gallery (url, caption, sort_order) VALUES (?,?,?)")
            ->execute([$url, $caption, $max + 1]);
        Response::success(['id' => (int)$this->db->lastInsertId(), 'url' => $url], 'Added', 201);
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $row = $this->db->prepare('SELECT url FROM homepage_gallery WHERE id = ?');
        $row->execute([$id]);
        $r = $row->fetch();
        if ($r && str_contains($r['url'], '/uploads/homepage_gallery/')) {
            $file = UPLOAD_DIR . 'homepage_gallery/' . basename($r['url']);
            if (file_exists($file)) @unlink($file);
        }
        $this->db->prepare('DELETE FROM homepage_gallery WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }
}
