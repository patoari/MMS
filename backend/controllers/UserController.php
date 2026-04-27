<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class UserController {
    private const ALLOWED_ROLES = ['visitor', 'teacher', 'class_teacher', 'admin', 'accountant'];

    public function index(): void {
        $caller = Auth::require();
        if ($caller['role'] !== 'admin') Response::error('Forbidden', 403);

        $db   = Database::connect();
        $stmt = $db->query("SELECT u.id, u.name, u.email, u.role, u.class_id, c.name AS class_name
                            FROM users u
                            LEFT JOIN classes c ON c.id = u.class_id
                            WHERE u.role != 'student'
                            ORDER BY u.id DESC");
        Response::success($stmt->fetchAll());
    }

    public function updateRole(int $id): void {
        $caller = Auth::require();
        if ($caller['role'] !== 'admin') Response::error('Forbidden', 403);
        if ((int)$caller['id'] === $id) Response::error('Cannot change your own role', 403);

        $body = json_decode(file_get_contents('php://input'), true);
        $role    = $body['role']     ?? '';
        $classId = $body['class_id'] ?? null;

        if (!in_array($role, self::ALLOWED_ROLES)) Response::error('Invalid role', 400);
        if ($role === 'class_teacher' && empty($classId)) Response::error('class_id required for class_teacher', 400);

        $db   = Database::connect();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if (!$user) Response::error('User not found', 404);

        // Clear class_id for non-class_teacher roles
        $assignedClassId = $role === 'class_teacher' ? (int)$classId : null;

        // Enforce one class_teacher per class
        if ($role === 'class_teacher') {
            $conflict = $db->prepare(
                "SELECT id FROM users WHERE role = 'class_teacher' AND class_id = ? AND id != ?"
            );
            $conflict->execute([$assignedClassId, $id]);
            if ($conflict->fetch()) Response::error('এই শ্রেণিতে ইতিমধ্যে একজন ক্লাস শিক্ষক নির্ধারিত আছেন।', 409);
        }

        // Handle role transitions
        $oldRole = $user['role'];
        
        // If demoting from teacher/class_teacher to visitor/admin, delete teacher record
        if (in_array($oldRole, ['teacher', 'class_teacher']) && !in_array($role, ['teacher', 'class_teacher'])) {
            // Delete teacher record when demoting
            $db->prepare('DELETE FROM teachers WHERE user_id = ?')->execute([$id]);
        }

        // Update user role and class_id
        $db->prepare('UPDATE users SET role = ?, class_id = ? WHERE id = ?')
           ->execute([$role, $assignedClassId, $id]);

        // Update existing teacher record when changing to teacher/class_teacher
        if (in_array($role, ['teacher', 'class_teacher'])) {
            $exists = $db->prepare('SELECT id FROM teachers WHERE user_id = ?');
            $exists->execute([$id]);
            
            if ($exists->fetch()) {
                // Update existing teacher record with new class_id
                $db->prepare("UPDATE teachers SET class_id = ?, status = 'সক্রিয়' WHERE user_id = ?")
                   ->execute([$assignedClassId, $id]);
            }
            // Note: Teacher records should be created manually from Teacher Management page
            // This ensures proper data entry (subject, phone, salary, etc.)
        }

        $user['role']     = $role;
        $user['class_id'] = $assignedClassId;
        Response::success($user);
    }

    public function destroy(int $id): void {
        $caller = Auth::require();
        if ($caller['role'] !== 'admin') Response::error('Forbidden', 403);
        if ((int)$caller['id'] === $id) Response::error('Cannot delete your own account', 403);

        $db   = Database::connect();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        
        if (!$user) Response::error('User not found', 404);

        // Only allow deleting visitors
        if ($user['role'] !== 'visitor') {
            Response::error('শুধুমাত্র ভিজিটর ব্যবহারকারীদের মুছে ফেলা যাবে। অন্য ভূমিকার জন্য প্রথমে ভিজিটরে পরিবর্তন করুন।', 403);
        }

        // Delete the user
        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        
        Response::success(['message' => 'User deleted successfully']);
    }

    public function resetPassword(int $id): void {
        $caller = Auth::require();
        if ($caller['role'] !== 'admin') Response::error('Forbidden', 403);

        $body = json_decode(file_get_contents('php://input'), true);
        $newPassword = trim($body['password'] ?? '');

        if (empty($newPassword)) Response::error('Password is required');
        if (strlen($newPassword) < 6) Response::error('Password must be at least 6 characters');

        $db   = Database::connect();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        
        if (!$user) Response::error('User not found', 404);

        // Hash the new password
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update password
        $db->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([$hash, $id]);
        
        Response::success([
            'message' => 'Password reset successfully',
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email']
            ]
        ]);
    }
}
