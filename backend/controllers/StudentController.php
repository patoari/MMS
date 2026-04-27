<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../helpers/PrefixHelper.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../helpers/QueryBuilder.php';
require_once __DIR__ . '/../helpers/ValidationHelper.php';
require_once __DIR__ . '/../middleware/Auth.php';

class StudentController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    /**
     * Transform photo URLs in student data
     */
    private function transformStudent(array $student): array {
        $student['photo'] = FileUpload::transformPhotoUrl($student['photo']);
        return $student;
    }


    public function index(): void {
        Auth::require();
        $search = $_GET['search'] ?? '';
        $class  = $_GET['class']  ?? '';
        $sessionId = $_GET['session_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        $archived = ($_GET['archived'] ?? '') === '1';
        
        // Use QueryBuilder for pagination
        $pagination = QueryBuilder::getPagination($_GET);
        extract($pagination); // $page, $limit, $offset

        // class_teacher: auto-restrict to their assigned class
        $caller = Auth::user();
        if (!$caller) Response::error('Authentication required', 401);
        
        if ($caller['role'] === 'class_teacher' && empty($class) && empty($classId)) {
            $uStmt = $this->db->prepare('SELECT c.name FROM users u LEFT JOIN classes c ON c.id = u.class_id WHERE u.id = ?');
            $uStmt->execute([$caller['id']]);
            $row = $uStmt->fetch();
            if ($row && $row['name']) $class = $row['name'];
        }

        $where = [$archived ? 's.deleted_at IS NOT NULL' : 's.deleted_at IS NULL'];
        $params = [];
        
        // Use QueryBuilder for search
        if ($search) {
            $where[] = QueryBuilder::buildSearch($search, ['s.name', 's.id'], $params);
        }
        
        if ($class) { 
            $where[] = 'c.name = ?'; 
            $params[] = $class; 
        }
        
        if ($classId) {
            $where[] = 's.class_id = ?';
            $params[] = $classId;
        }
        
        // Filter by session - default to current session if not specified
        if ($sessionId) {
            $where[] = 's.session_id = ?';
            $params[] = $sessionId;
        } elseif (!$archived) {
            // Default to current session for active students
            $currentStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
            $currentSession = $currentStmt->fetch();
            if ($currentSession) {
                $where[] = 's.session_id = ?';
                $params[] = $currentSession['id'];
            }
        }

        $whereClause = implode(' AND ', $where);
        $sql = "SELECT s.*, c.name AS class FROM students s
                JOIN classes c ON c.id = s.class_id
                WHERE $whereClause ORDER BY s.id LIMIT ? OFFSET ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([...$params, $limit, $offset]);
        $items = $stmt->fetchAll();

        // Transform photo paths to full URLs
        $items = array_map(fn($item) => $this->transformStudent($item), $items);

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM students s JOIN classes c ON c.id = s.class_id WHERE $whereClause");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        Response::paginate($items, $total, $page, $limit);
    }

    public function show(string $id): void {
        Auth::require();
        $stmt = $this->db->prepare('SELECT s.*, c.name AS class FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?');
        $stmt->execute([$id]);
        $student = $stmt->fetch();
        if (!$student) Response::error('Student not found', 404);
        Response::success($this->transformStudent($student));
    }

    public function store(): void {
        Auth::requireRole('admin');

        // Support multipart/form-data (with file) or JSON
        if (!empty($_FILES['photo'])) {
            $body = $_POST;
        } else {
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
        }

        // Use ValidationHelper for required fields
        try {
            ValidationHelper::requireFields($body, ['name','class','father_name_bn','phone','address']);
        } catch (Exception $e) {
            Response::error($e->getMessage());
        }

        // Handle photo upload using FileUpload helper
        $photoPath = null;
        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            try {
                $photoPath = FileUpload::uploadImage($_FILES['photo'], 'students', 'stu_');
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } elseif (!empty($body['photo'])) {
            // External URL provided
            $photoPath = filter_var($body['photo'], FILTER_VALIDATE_URL) ? $body['photo'] : null;
        }

        // Resolve class_id
        $stmt = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $stmt->execute([$body['class']]);
        $classRow = $stmt->fetch();
        if (!$classRow || !isset($classRow['id'])) Response::error('Invalid class');

        // Get current session
        $sessionStmt = $this->db->query("SELECT id FROM academic_sessions WHERE is_current = 1 LIMIT 1");
        $currentSession = $sessionStmt->fetch();
        if (!$currentSession) Response::error('No active session found. Please create and activate a session first.');
        $sessionId = $currentSession['id'];

        // Generate unique ID using dynamic prefix from settings
        $prefix = PrefixHelper::student($this->db);
        $newId = IdGenerator::generate($this->db, 'students', $prefix, true, 4);

        // roll = max existing roll in this class + 1
        $rollStmt = $this->db->prepare("SELECT MAX(roll) FROM students WHERE class_id = ? AND session_id = ?");
        $rollStmt->execute([$classRow['id'], $sessionId]);
        $roll = (int)$rollStmt->fetchColumn() + 1;

        $ins = $this->db->prepare("INSERT INTO students (id, name, name_bn, name_en, class_id, roll, section, guardian, father_name_bn, father_name_en, mother_name_bn, mother_name_en, guardian_type, guardian_name, guardian_relation, phone, address, photo, status, session_id)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Determine guardian name based on guardian_type
        $guardianType = $body['guardian_type'] ?? 'father';
        $guardianName = '';
        if ($guardianType === 'father') {
            $guardianName = $body['father_name_bn'] ?? '';
        } elseif ($guardianType === 'mother') {
            $guardianName = $body['mother_name_bn'] ?? '';
        } else {
            $guardianName = $body['guardian_name'] ?? '';
        }
        
        $ins->execute([
            $newId, 
            $body['name'], 
            $body['name_bn'] ?? $body['name'], 
            $body['name_en'] ?? null,
            $classRow['id'], 
            $roll,
            $body['section'] ?? 'ক', 
            $guardianName, // Use selected guardian's name
            $body['father_name_bn'] ?? '',
            $body['father_name_en'] ?? null,
            $body['mother_name_bn'] ?? null,
            $body['mother_name_en'] ?? null,
            $guardianType,
            $body['guardian_name'] ?? null,
            $body['guardian_relation'] ?? null,
            $body['phone'],
            $body['address'], 
            $photoPath, 
            $body['status'] ?? 'সক্রিয়', 
            $sessionId
        ]);

        // Auto-create admission fee if defined in fee_settings for this class
        $feeSettingStmt = $this->db->prepare("SELECT admission FROM fee_settings WHERE class_id = ?");
        $feeSettingStmt->execute([$classRow['id']]);
        $feeSetting = $feeSettingStmt->fetch();
        if ($feeSetting && (float)$feeSetting['admission'] > 0) {
            $feeId = 'FEE-' . date('Ymd') . '-' . strtoupper(substr(uniqid('', true), -6));
            $this->db->prepare("INSERT INTO fees (id, student_id, category, month, amount, paid, status, session_id)
                                VALUES (?, ?, 'ভর্তি ফি', ?, ?, 0, 'বকেয়া', ?)")
                ->execute([$feeId, $newId, date('Y'), $feeSetting['admission'], $sessionId]);
        }

        Response::success(['id' => $newId], 'Student created', 201);
    }

    public function update(string $id): void {
        Auth::requireRole('admin');
        
        // Support multipart/form-data (with file) or JSON
        if (!empty($_FILES['photo'])) {
            $body = $_POST;
        } else {
            $body = json_decode(file_get_contents('php://input'), true);
        }

        $fields = []; $params = [];
        
        // Handle photo upload FIRST
        if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
            try {
                // Delete old photo if exists
                $oldStmt = $this->db->prepare('SELECT photo FROM students WHERE id = ?');
                $oldStmt->execute([$id]);
                $oldPhoto = $oldStmt->fetchColumn();
                if ($oldPhoto && !filter_var($oldPhoto, FILTER_VALIDATE_URL)) {
                    FileUpload::delete($oldPhoto);
                }
                
                // Upload new photo
                $photoPath = FileUpload::uploadImage($_FILES['photo'], 'students', 'stu_');
                $fields[] = 'photo = ?';
                $params[] = $photoPath;
            } catch (Exception $e) {
                Response::error($e->getMessage());
            }
        } elseif (isset($body['photo'])) {
            // External URL or path provided
            $fields[] = 'photo = ?';
            $params[] = $body['photo'];
        }
        
        // Handle other fields
        $allowed = ['name','name_bn','name_en','section','guardian','father_name_bn','father_name_en','mother_name_bn','mother_name_en','guardian_type','guardian_name','guardian_relation','phone','address','status','roll'];
        foreach ($allowed as $f) {
            if (isset($body[$f]) && $body[$f] !== '') { 
                $fields[] = "$f = ?"; 
                $params[] = $f === 'roll' ? (int)$body[$f] : $body[$f]; 
            }
        }
        
        // Auto-update guardian field based on guardian_type
        if (isset($body['guardian_type'])) {
            $guardianType = $body['guardian_type'];
            $guardianName = '';
            if ($guardianType === 'father' && isset($body['father_name_bn'])) {
                $guardianName = $body['father_name_bn'];
            } elseif ($guardianType === 'mother' && isset($body['mother_name_bn'])) {
                $guardianName = $body['mother_name_bn'];
            } elseif ($guardianType === 'other' && isset($body['guardian_name'])) {
                $guardianName = $body['guardian_name'];
            }
            if ($guardianName) {
                $fields[] = "guardian = ?";
                $params[] = $guardianName;
            }
        }
        
        if (isset($body['class'])) {
            $stmt = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
            $stmt->execute([$body['class']]);
            $row = $stmt->fetch();
            if ($row) { $fields[] = 'class_id = ?'; $params[] = $row['id']; }
        }
        
        if (!$fields) Response::error('Nothing to update');
        $params[] = $id;
        $this->db->prepare("UPDATE students SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        Response::success(null, 'Updated');
    }

    public function destroy(string $id): void {
        Auth::requireRole('admin');
        // Soft delete — preserve all data, just mark as deleted and deactivate
        $this->db->prepare("UPDATE students SET deleted_at = NOW(), status = 'নিষ্ক্রিয়' WHERE id = ?")
            ->execute([$id]);
        Response::success(null, 'Archived');
    }

    public function restore(string $id): void {
        Auth::requireRole('admin');
        $this->db->prepare("UPDATE students SET deleted_at = NULL, status = 'সক্রিয়' WHERE id = ?")
            ->execute([$id]);
        Response::success(null, 'Restored');
    }

    public function me(): void {
        $user = Auth::requireRole('student');
        $stmt = $this->db->prepare('SELECT s.*, c.name AS class FROM students s JOIN classes c ON c.id = s.class_id WHERE s.user_id = ?');
        $stmt->execute([$user['id']]);
        $student = $stmt->fetch();
        if (!$student) Response::error('Profile not found', 404);
        Response::success($this->transformStudent($student));
    }
}
