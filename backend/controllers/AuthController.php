<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class AuthController {
    public function register(): void {
        $body = json_decode(file_get_contents('php://input'), true);
        $name     = trim($body['name'] ?? '');
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (!$name || !$email || !$password) Response::error('Name, email and password required');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('Invalid email');
        if (!preg_match('/@dhamalkot\.com$/i', $email)) Response::error('শুধুমাত্র @dhamalkot.com ইমেইল দিয়ে রেজিস্ট্রেশন করা যাবে');

        $db = Database::connect();

        $check = $db->prepare('SELECT id FROM users WHERE email = ?');
        $check->execute([$email]);
        if ($check->fetch()) Response::error('Email already registered', 409);

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $hash, 'visitor']);

        Response::success(['message' => 'Registration successful'], 'Registration successful', 201);
    }

    public function studentLogin(): void {
        $body      = json_decode(file_get_contents('php://input'), true);
        $studentId = trim($body['studentId'] ?? '');
        
        if (!$studentId) Response::error('Student ID required');

        $db   = Database::connect();
        // find student
        $stmt = $db->prepare('SELECT s.*, c.name AS class FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND s.deleted_at IS NULL');
        $stmt->execute([$studentId]);
        $student = $stmt->fetch();
        if (!$student) Response::error('শিক্ষার্থী আইডি সঠিক নয়।', 404);

        // get or create a user record for this student
        $userId = $student['user_id'];
        if (!$userId) {
            // create a minimal user record (no password needed — ID-only login)
            $ins = $db->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')");
            $ins->execute([
                $student['name'],
                $studentId . '@student.local',
                password_hash(uniqid('', true), PASSWORD_BCRYPT) // random password, never used
            ]);
            $userId = (int)$db->lastInsertId();
            $db->prepare('UPDATE students SET user_id = ? WHERE id = ?')->execute([$userId, $studentId]);
        }

        $userStmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();

        $token = JWT::encode([
            'id'    => $user['id'],
            'email' => $user['email'],
            'role'  => 'student',
            'name'  => $user['name'],
        ]);

        Response::success([
            'token'     => $token,
            'user'      => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => 'student'],
            'studentId' => $studentId,
        ]);
    }

    public function login(): void {
        $body = json_decode(file_get_contents('php://input'), true);
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (!$email || !$password) Response::error('Email and password required');

        $db   = Database::connect();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password']))
            Response::error('Invalid credentials', 401);

        $token = JWT::encode([
            'id'    => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'name'  => $user['name'],
        ]);

        // attach studentId if student
        $extra = [];
        if ($user['role'] === 'student') {
            $s = $db->prepare('SELECT id FROM students WHERE user_id = ?');
            $s->execute([$user['id']]);
            $row = $s->fetch();
            if ($row) $extra['studentId'] = $row['id'];
        }
        // attach teacherId if teacher or class_teacher — auto-link by name if not yet linked
        if (in_array($user['role'], ['teacher', 'class_teacher'])) {
            $t = $db->prepare('SELECT id FROM teachers WHERE user_id = ?');
            $t->execute([$user['id']]);
            $row = $t->fetch();
            if (!$row) {
                // Try to auto-link by matching name (case-insensitive)
                $t2 = $db->prepare('SELECT id FROM teachers WHERE user_id IS NULL AND LOWER(name) = LOWER(?) LIMIT 1');
                $t2->execute([$user['name']]);
                $row = $t2->fetch();
                if ($row) {
                    $db->prepare('UPDATE teachers SET user_id = ? WHERE id = ?')->execute([$user['id'], $row['id']]);
                }
            }
            if ($row) $extra['teacherId'] = $row['id'];
        }

        Response::success(array_merge([
            'token' => $token,
            'user'  => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
        ], $extra));
    }

    public function me(): void {
        $user = Auth::require();
        Response::success($user);
    }
}
