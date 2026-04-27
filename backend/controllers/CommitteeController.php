<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/Auth.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/FileUpload.php';

class CommitteeController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // GET /committee-members - Public endpoint
    public function index(): void {
        $stmt = $this->db->query("
            SELECT * FROM committee_members 
            WHERE is_active = 1 
            ORDER BY sort_order ASC, id ASC
        ");
        $members = $stmt->fetchAll();
        
        // Transform photo URLs
        $members = array_map(function($m) {
            $m['photo'] = FileUpload::transformPhotoUrl($m['photo']);
            return $m;
        }, $members);
        
        Response::success($members);
    }

    // GET /committee-members/all - Admin endpoint (includes inactive)
    public function all(): void {
        Auth::requireRole('admin');
        $stmt = $this->db->query("
            SELECT * FROM committee_members 
            ORDER BY sort_order ASC, id ASC
        ");
        $members = $stmt->fetchAll();
        
        // Transform photo URLs
        $members = array_map(function($m) {
            $m['photo'] = FileUpload::transformPhotoUrl($m['photo']);
            return $m;
        }, $members);
        
        Response::success($members);
    }

    // POST /committee-members
    public function store(): void {
        Auth::requireRole('admin');
        
        // Support multipart/form-data (with file) or JSON
        if (!empty($_FILES['photo'])) {
            $body = $_POST;
        } else {
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
        }

        $required = ['name', 'position'];
        foreach ($required as $f) {
            if (empty($body[$f])) Response::error("Field '$f' is required");
        }

        // Handle photo upload
        $photoPath = null;
        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            try {
                $photoPath = FileUpload::uploadImage($_FILES['photo'], 'committee', 'cm_');
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } elseif (!empty($body['photo'])) {
            $photoPath = $body['photo'];
        }

        $stmt = $this->db->prepare("
            INSERT INTO committee_members (name, position, photo, phone, email, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $body['name'],
            $body['position'],
            $photoPath,
            $body['phone'] ?? null,
            $body['email'] ?? null,
            (int)($body['sort_order'] ?? 0),
            isset($body['is_active']) ? (int)$body['is_active'] : 1,
        ]);

        Response::success(['id' => $this->db->lastInsertId()], 'Committee member added');
    }

    // PUT /committee-members/:id
    public function update(string $id): void {
        Auth::requireRole('admin');
        
        // Support multipart/form-data (with file) or JSON
        if (!empty($_FILES['photo'])) {
            $body = $_POST;
        } else {
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
        }

        // Get existing member
        $stmt = $this->db->prepare("SELECT * FROM committee_members WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) Response::error('Committee member not found', 404);

        // Handle photo upload
        $photoPath = $existing['photo'];
        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            try {
                // Delete old photo if exists
                if ($existing['photo'] && !filter_var($existing['photo'], FILTER_VALIDATE_URL)) {
                    FileUpload::delete($existing['photo']);
                }
                $photoPath = FileUpload::uploadImage($_FILES['photo'], 'committee', 'cm_');
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } elseif (isset($body['photo'])) {
            $photoPath = $body['photo'];
        }

        $stmt = $this->db->prepare("
            UPDATE committee_members 
            SET name = ?, position = ?, photo = ?, phone = ?, email = ?, 
                sort_order = ?, is_active = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $body['name'] ?? $existing['name'],
            $body['position'] ?? $existing['position'],
            $photoPath,
            $body['phone'] ?? $existing['phone'],
            $body['email'] ?? $existing['email'],
            isset($body['sort_order']) ? (int)$body['sort_order'] : $existing['sort_order'],
            isset($body['is_active']) ? (int)$body['is_active'] : $existing['is_active'],
            $id,
        ]);

        Response::success(null, 'Committee member updated');
    }

    // DELETE /committee-members/:id
    public function destroy(string $id): void {
        Auth::requireRole('admin');
        $stmt = $this->db->prepare("DELETE FROM committee_members WHERE id = ?");
        $stmt->execute([$id]);
        Response::success(null, 'Committee member deleted');
    }

    // PUT /committee-members/:id/toggle
    public function toggle(string $id): void {
        Auth::requireRole('admin');
        $stmt = $this->db->prepare("
            UPDATE committee_members 
            SET is_active = NOT is_active 
            WHERE id = ?
        ");
        $stmt->execute([$id]);
        Response::success(null, 'Status toggled');
    }

    // POST /committee-members/upload - Upload photo only
    public function uploadPhoto(): void {
        Auth::requireRole('admin');
        
        if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No photo uploaded');
        }

        try {
            $photoPath = FileUpload::uploadImage($_FILES['photo'], 'committee', 'cm_');
            $photoUrl = FileUpload::transformPhotoUrl($photoPath);
            
            Response::success(['path' => $photoPath, 'url' => $photoUrl], 'Photo uploaded');
        } catch (Exception $e) {
            Response::error($e->getMessage());
        }
    }
}
