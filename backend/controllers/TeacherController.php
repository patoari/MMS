<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../helpers/PrefixHelper.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../middleware/Auth.php';

class TeacherController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    /**
     * Transform photo URLs in teacher data
     */
    private function transformTeacher(array $teacher): array {
        $teacher['photo'] = FileUpload::transformPhotoUrl($teacher['photo']);
        return $teacher;
    }

    public function index(): void {
        Auth::requireRole('admin', 'accountant', 'class_teacher');

        $db = Database::connect();
        $archived = ($_GET['archived'] ?? '') === '1';
        
        // Get all users with teacher, class_teacher, or admin roles
        // Join with teachers table to get additional info if exists
        $stmt = $db->query("
            SELECT 
                COALESCE(t.id, CONCAT('USER-', u.id)) as id,
                u.id as user_id,
                COALESCE(t.name, u.name) as name,
                u.email as user_email,
                u.role,
                CASE 
                    WHEN u.role = 'admin' THEN 'প্রধান শিক্ষক'
                    ELSE COALESCE(t.subject, '')
                END as subject,
                COALESCE(t.class_id, u.class_id) as class_id,
                c.name as class,
                COALESCE(t.phone, '') as phone,
                COALESCE(t.email, u.email) as email,
                COALESCE(t.address, '') as address,
                COALESCE(t.qualification, '') as qualification,
                COALESCE(t.join_date, '') as join_date,
                t.photo,
                COALESCE(t.salary, 0) as salary,
                COALESCE(t.status, 'সক্রিয়') as status,
                t.deleted_at,
                CASE WHEN t.id IS NULL THEN 1 ELSE 0 END as is_user_only
            FROM users u
            LEFT JOIN teachers t ON t.user_id = u.id
            LEFT JOIN classes c ON c.id = COALESCE(t.class_id, u.class_id)
            WHERE u.role IN ('teacher', 'class_teacher', 'admin')
              AND " . ($archived ? "t.deleted_at IS NOT NULL" : "(t.deleted_at IS NULL OR t.id IS NULL)") . "
            ORDER BY 
                CASE u.role 
                    WHEN 'admin' THEN 1 
                    WHEN 'class_teacher' THEN 2 
                    WHEN 'teacher' THEN 3 
                END,
                u.name
        ");
        $items = $stmt->fetchAll();
        
        // Transform photo paths to full URLs
        $items = array_map(fn($item) => $this->transformTeacher($item), $items);
        
        Response::success($items);
    }
    public function store(): void {
        Auth::requireRole('admin');
        
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['name','subject','phone','salary'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");

        // Check if this is for an existing user (from incomplete profile)
        $userId = isset($body['user_id']) ? (int)$body['user_id'] : null;
        
        // If user_id provided, check if teacher record already exists
        if ($userId) {
            $existing = $this->db->prepare('SELECT id FROM teachers WHERE user_id = ?');
            $existing->execute([$userId]);
            if ($existing->fetch()) {
                Response::error('এই ব্যবহারকারীর জন্য ইতিমধ্যে শিক্ষক প্রোফাইল রয়েছে।', 409);
            }
        }

        // Generate unique ID using IdGenerator helper
        $newId = IdGenerator::generate($this->db, 'teachers', 'TCH', true, 3);

        $classId = null;
        if (!empty($body['class'])) {
            $s = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
            $s->execute([$body['class']]);
            $row = $s->fetch();
            $classId = $row ? $row['id'] : null;
        }

        $this->db->prepare("INSERT INTO teachers (id, user_id, name, subject, class_id, phone, email, address, qualification, join_date, salary, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $newId, $userId, $body['name'], $body['subject'], $classId,
                $body['phone'], $body['email'] ?? null, $body['address'] ?? null,
                $body['qualification'] ?? null, $body['join_date'] ?? null,
                $body['salary'], $body['status'] ?? 'সক্রিয়'
            ]);
        Response::success(['id' => $newId], 'Teacher created', 201);
    }

    public function update(string $id): void {
        Auth::requireRole('admin');
        
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        
        $fields = []; $params = [];
        
        foreach (['name','subject','phone','email','address','qualification','join_date','salary','status'] as $f) {
            if (isset($body[$f])) { 
                $fields[] = "$f = ?"; 
                $params[] = $body[$f] === '' ? null : $body[$f]; 
            }
        }
        
        if (isset($body['class'])) {
            $s = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
            $s->execute([$body['class']]);
            $row = $s->fetch();
            $fields[] = 'class_id = ?'; 
            $params[] = $row ? $row['id'] : null;
        }
        
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id;
        $this->db->prepare("UPDATE teachers SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        Response::success(null, 'Updated');
    }


    public function destroy(string $id): void {
        Auth::requireRole('admin');
        // Soft delete — preserve salary history and all records
        $this->db->prepare("UPDATE teachers SET deleted_at = NOW(), status = 'নিষ্ক্রিয়' WHERE id = ?")
            ->execute([$id]);
        // Deactivate the linked user account (fetch user_id first, then update)
        $row = $this->db->prepare('SELECT user_id FROM teachers WHERE id = ?');
        $row->execute([$id]);
        $t = $row->fetch();
        if ($t && $t['user_id']) {
            $this->db->prepare("UPDATE users SET role = 'visitor' WHERE id = ?")
                ->execute([$t['user_id']]);
        }
        Response::success(null, 'Archived');
    }

    public function restore(string $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("UPDATE teachers SET deleted_at = NULL, status = 'সক্রিয়' WHERE id = ?")
            ->execute([$id]);
        // Restore the linked user's role to teacher
        $row = $this->db->prepare('SELECT user_id FROM teachers WHERE id = ?');
        $row->execute([$id]);
        $t = $row->fetch();
        if ($t && $t['user_id']) {
            $this->db->prepare("UPDATE users SET role = 'teacher' WHERE id = ?")
                ->execute([$t['user_id']]);
        }
        Response::success(null, 'Restored');
    }

    // PUT /teachers/{id}/link-user  { user_id }
    public function linkUser(string $id): void {
        Auth::requireRole('admin');
        $body   = json_decode(file_get_contents('php://input'), true);
        $userId = $body['user_id'] ?? null;

        // Validate user exists if provided
        if ($userId) {
            $userCheck = $this->db->prepare('SELECT id FROM users WHERE id = ?');
            $userCheck->execute([$userId]);
            if (!$userCheck->fetch()) {
                Response::error('ব্যবহারকারী পাওয়া যায়নি', 404);
            }
            
            // Ensure no other teacher is already linked to this user
            $conflict = $this->db->prepare('SELECT id FROM teachers WHERE user_id = ? AND id != ?');
            $conflict->execute([$userId, $id]);
            if ($conflict->fetch()) Response::error('এই ব্যবহারকারী ইতিমধ্যে অন্য একজন শিক্ষকের সাথে যুক্ত।', 409);
        }

        $this->db->prepare('UPDATE teachers SET user_id = ? WHERE id = ?')
            ->execute([$userId ?: null, $id]);
        Response::success(null, 'Teacher linked');
    }

    public function me(): void {
        $user = Auth::requireRole('teacher', 'class_teacher');
        $stmt = $this->db->prepare('SELECT t.*, c.name AS class FROM teachers t LEFT JOIN classes c ON c.id = t.class_id WHERE t.user_id = ?');
        $stmt->execute([$user['id']]);
        $teacher = $stmt->fetch();

        // For class_teacher: if no teacher record, build a minimal profile from users + assigned class
        if (!$teacher && $user['role'] === 'class_teacher') {
            $uStmt = $this->db->prepare('SELECT u.name, u.email, c.name AS class, c.id AS class_id FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?');
            $uStmt->execute([$user['id']]);
            $teacher = $uStmt->fetch() ?: ['name' => $user['name'], 'class' => null];
        }

        Response::success($teacher ? $this->transformTeacher($teacher) : $teacher);
    }
}
