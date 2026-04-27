<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/FileUpload.php';
require_once __DIR__ . '/../middleware/Auth.php';

class LogoController {
    public function upload(): void {
        Auth::requireRole('admin');

        if (empty($_FILES['logo'])) Response::error('No file uploaded');
        
        try {
            // Remove old logo files first
            $dir = UPLOAD_DIR . 'logo/';
            if (is_dir($dir)) {
                foreach (glob($dir . 'logo.*') as $old) @unlink($old);
            }
            
            // Upload new logo (FileUpload helper supports SVG for logos)
            $file = $_FILES['logo'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            
            // Special handling for SVG (not in FileUpload::uploadImage)
            if ($ext === 'svg') {
                if ($file['error'] !== UPLOAD_ERR_OK) Response::error('Upload error');
                if ($file['size'] > 5 * 1024 * 1024) Response::error('File too large. Max 5MB.');
                
                if (!is_dir($dir)) mkdir($dir, 0755, true);
                $filename = 'logo.' . $ext;
                if (!move_uploaded_file($file['tmp_name'], $dir . $filename))
                    Response::error('Failed to save file');
                $logoUrl = UPLOAD_URL . 'logo/' . $filename;
            } else {
                // Use FileUpload helper for image files
                $relativePath = FileUpload::uploadImage($file, 'logo', 'logo');
                // Rename to logo.ext for consistency
                $oldPath = UPLOAD_DIR . $relativePath;
                $newPath = $dir . 'logo.' . $ext;
                rename($oldPath, $newPath);
                $logoUrl = UPLOAD_URL . 'logo/logo.' . $ext;
            }
        } catch (Exception $e) {
            Response::error($e->getMessage());
        }

        $db   = Database::connect();
        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $db->prepare("INSERT INTO site_settings (setting_key, setting_value, updated_by)
                      VALUES ('logoUrl', ?, ?)
                      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)")
           ->execute([$logoUrl, $user['id']]);

        Response::success(['logoUrl' => $logoUrl], 'Logo uploaded');
    }
}
