<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../middleware/Auth.php';

class GalleryController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query("SELECT * FROM gallery ORDER BY uploaded_at DESC");
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

        if (!empty($_FILES['image'])) {
            try {
                $relativePath = FileUpload::uploadImage($_FILES['image'], 'gallery', 'img_');
                $url = FileUpload::getUrl($relativePath);
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } else {
            $body = json_decode(file_get_contents('php://input'), true);
            $url  = trim($body['url'] ?? '');
            if (!$url) Response::error('url or image file required');
        }

        $caption = $_POST['caption'] ?? '';
        if (!$caption) {
            $body    = json_decode(file_get_contents('php://input'), true);
            $caption = $body['caption'] ?? '';
        }

        $user = Auth::user();
        if (!$user) Response::error('Authentication required', 401);
        
        $stmt = $this->db->prepare("INSERT INTO gallery (url, caption, uploaded_by) VALUES (?,?,?)");
        $stmt->execute([$url, $caption, $user['id'] ?? null]);
        Response::success(['id' => (int)$this->db->lastInsertId(), 'url' => $url], 'Image added', 201);
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        // Also delete the file from disk if it's a local upload
        $row = $this->db->prepare('SELECT url FROM gallery WHERE id = ?');
        $row->execute([$id]);
        $r = $row->fetch();
        if ($r && str_contains($r['url'], '/uploads/gallery/')) {
            $file = UPLOAD_DIR . 'gallery/' . basename($r['url']);
            if (file_exists($file)) @unlink($file);
        }
        $this->db->prepare('DELETE FROM gallery WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }
}
