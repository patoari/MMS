<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class NoticeController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $category  = $_GET['category']  ?? '';
        $important = $_GET['important'] ?? '';
        $status    = $_GET['status']    ?? '';
        $where = ['1=1']; $params = [];
        if ($category)  { $where[] = 'category = ?';    $params[] = $category; }
        if ($important !== '') { $where[] = 'is_important = ?'; $params[] = (int)$important; }

        // Only admins can see draft notices; everyone else only sees published
        $user = Auth::user();
        $isAdmin = $user && isset($user['role']) && in_array($user['role'], ['admin', 'accountant']);

        if ($isAdmin && $status) {
            $where[] = 'status = ?'; $params[] = $status;
        } elseif (!$isAdmin) {
            $where[] = "status = 'published'";
        }
        // admin with no status filter sees all

        $stmt = $this->db->prepare("SELECT * FROM notices WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['title','content','category'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");

        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $status = $body['status'] ?? 'published'; // Default to published for manual creation
        $stmt = $this->db->prepare("INSERT INTO notices (title, content, category, is_important, status, created_by) VALUES (?,?,?,?,?,?)");
        $stmt->execute([
            $body['title'], 
            $body['content'], 
            $body['category'], 
            (int)($body['is_important'] ?? 0),
            $status,
            $user['id']
        ]);
        Response::success(['id' => $this->db->lastInsertId()], 'Notice created', 201);
    }

    public function update(int $id): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        
        $fields = []; $params = [];
        if (isset($body['title']))        { $fields[] = 'title = ?';        $params[] = $body['title']; }
        if (isset($body['content']))      { $fields[] = 'content = ?';      $params[] = $body['content']; }
        if (isset($body['category']))     { $fields[] = 'category = ?';     $params[] = $body['category']; }
        if (isset($body['is_important'])) { $fields[] = 'is_important = ?'; $params[] = (int)$body['is_important']; }
        if (isset($body['status']))       { $fields[] = 'status = ?';       $params[] = $body['status']; }
        
        if (empty($fields)) Response::error('Nothing to update');
        
        $params[] = $id;
        $this->db->prepare("UPDATE notices SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        Response::success(null, 'Notice updated');
    }

    public function approve(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("UPDATE notices SET status = 'published' WHERE id = ?")->execute([$id]);
        Response::success(null, 'Notice published');
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare('DELETE FROM notices WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }
}
