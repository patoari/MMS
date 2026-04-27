<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SettingsController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        $stmt = $this->db->query("SELECT setting_key, setting_value FROM site_settings");
        $rows = $stmt->fetchAll();
        $out = [];
        foreach ($rows as $r) $out[$r['setting_key']] = $r['setting_value'];

        // Inject live stats
        $out['liveStudentCount'] = (int)$this->db->query("SELECT COUNT(*) FROM students WHERE deleted_at IS NULL")->fetchColumn();
        $out['liveTeacherCount'] = (int)$this->db->query("SELECT COUNT(*) FROM teachers WHERE deleted_at IS NULL")->fetchColumn();

        Response::success($out);
    }

    public function update(): void {
        Auth::requireRole('admin');
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) Response::error('Object expected');

        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $stmt = $this->db->prepare("INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
                                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)");
        foreach ($body as $key => $value) {
            $stmt->execute([preg_replace('/[^a-zA-Z0-9_]/', '', $key), (string)$value, $user['id']]);
        }
        Response::success(null, 'Settings updated');
    }
}
