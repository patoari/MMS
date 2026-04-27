<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SubjectController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    // GET /class-subjects?class=ক্লাস ৮
    public function index(): void {
        $class = $_GET['class'] ?? '';
        if ($class) {
            $stmt = $this->db->prepare("
                SELECT cs.id, cs.subject, cs.teacher_id, t.name AS teacher_name
                FROM class_subjects cs
                JOIN classes c ON c.id = cs.class_id
                LEFT JOIN teachers t ON t.id = cs.teacher_id
                WHERE c.name = ? ORDER BY cs.id");
            $stmt->execute([$class]);
        } else {
            $stmt = $this->db->query("
                SELECT c.name AS class_name, cs.id, cs.subject, cs.teacher_id, t.name AS teacher_name
                FROM class_subjects cs
                JOIN classes c ON c.id = cs.class_id
                LEFT JOIN teachers t ON t.id = cs.teacher_id
                ORDER BY c.id, cs.id");
        }
        Response::success($stmt->fetchAll());
    }

    // POST /class-subjects  { class, subject }
    public function store(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        if (empty($body['class']) || empty($body['subject'])) Response::error('class and subject required');

        $cls = $this->db->prepare('SELECT id FROM classes WHERE name = ?');
        $cls->execute([$body['class']]);
        $row = $cls->fetch();
        if (!$row) Response::error('Invalid class');

        $this->db->prepare('INSERT IGNORE INTO class_subjects (class_id, subject) VALUES (?,?)')
            ->execute([$row['id'], trim($body['subject'])]);
        Response::success(null, 'Subject added', 201);
    }

    // DELETE /class-subjects/{id}
    public function destroy(int $id): void {
        Auth::requireRole('admin');
        $this->db->prepare('DELETE FROM class_subjects WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }

    // PUT /class-subjects/{id}/teacher  { teacher_id }
    public function updateTeacher(int $id): void {
        Auth::requireRole('admin');
        $body      = json_decode(file_get_contents('php://input'), true);
        $teacherId = $body['teacher_id'] ?? null;
        $this->db->prepare('UPDATE class_subjects SET teacher_id = ? WHERE id = ?')
            ->execute([$teacherId ?: null, $id]);

        // Return updated row with teacher name
        $stmt = $this->db->prepare("
            SELECT cs.id, cs.subject, cs.teacher_id, t.name AS teacher_name
            FROM class_subjects cs LEFT JOIN teachers t ON t.id = cs.teacher_id
            WHERE cs.id = ?");
        $stmt->execute([$id]);
        Response::success($stmt->fetch());
    }
}
