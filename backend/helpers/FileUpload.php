<?php
/**
 * File Upload Helper
 * Standardized file upload handling with validation
 */
require_once __DIR__ . '/../config/app.php';

class FileUpload {
    private const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    private const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    
    /**
     * Upload an image file
     * 
     * @param array $file $_FILES array element
     * @param string $directory Subdirectory under uploads/ (e.g., 'students', 'teachers')
     * @param string $prefix Filename prefix (e.g., 'stu_', 'ht_')
     * @param int $maxSize Maximum file size in bytes (default 5MB)
     * @return string Relative path to uploaded file (e.g., 'students/stu_123.jpg')
     * @throws Exception on validation or upload failure
     */
    public static function uploadImage(
        array $file,
        string $directory,
        string $prefix = '',
        int $maxSize = self::MAX_FILE_SIZE
    ): string {
        // Check if file was uploaded
        if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('ফাইল আপলোড করতে ব্যর্থ হয়েছে');
        }
        
        // Validate file size
        if ($file['size'] > $maxSize) {
            $maxMB = round($maxSize / (1024 * 1024), 1);
            throw new Exception("ফাইলের আকার {$maxMB} MB এর কম হতে হবে");
        }
        
        // Validate file extension
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_IMAGE_TYPES)) {
            throw new Exception('শুধুমাত্র JPG, PNG, GIF, WEBP ছবি আপলোড করা যাবে');
        }
        
        // Validate MIME type (security)
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, self::ALLOWED_IMAGE_MIMES)) {
            throw new Exception('অবৈধ ফাইল টাইপ');
        }
        
        // Validate MIME type matches extension (security check)
        $expectedMimes = [
            'jpg'  => ['image/jpeg'],
            'jpeg' => ['image/jpeg'],
            'png'  => ['image/png'],
            'gif'  => ['image/gif'],
            'webp' => ['image/webp']
        ];
        
        if (!isset($expectedMimes[$ext]) || !in_array($mimeType, $expectedMimes[$ext])) {
            throw new Exception('ফাইল এক্সটেনশন এবং টাইপ মিলছে না');
        }
        
        // Create upload directory if it doesn't exist
        $uploadDir = UPLOAD_DIR . $directory . DIRECTORY_SEPARATOR;
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0750, true)) {
                throw new Exception('আপলোড ডিরেক্টরি তৈরি করতে ব্যর্থ হয়েছে');
            }
        }
        
        // Generate unique filename
        $filename = $prefix . uniqid() . '.' . $ext;
        $destination = $uploadDir . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            throw new Exception('ফাইল সংরক্ষণ করতে ব্যর্থ হয়েছে');
        }
        
        // Return relative path
        return $directory . '/' . $filename;
    }
    
    /**
     * Delete a file
     * 
     * @param string $relativePath Relative path from UPLOAD_DIR (e.g., 'students/stu_123.jpg')
     * @return bool True if deleted or file doesn't exist, false on error
     */
    public static function delete(string $relativePath): bool {
        if (empty($relativePath)) {
            return true;
        }
        
        // Path traversal protection - ensure path doesn't contain ../ or absolute paths
        if (strpos($relativePath, '..') !== false || strpos($relativePath, DIRECTORY_SEPARATOR) === 0) {
            error_log("Attempted path traversal in FileUpload::delete: $relativePath");
            return false;
        }
        
        $fullPath = UPLOAD_DIR . $relativePath;
        
        // Additional security check - ensure resolved path is within UPLOAD_DIR
        $realUploadDir = realpath(UPLOAD_DIR);
        $realFilePath = realpath($fullPath);
        
        if ($realFilePath && strpos($realFilePath, $realUploadDir) !== 0) {
            error_log("Attempted to delete file outside upload directory: $relativePath");
            return false;
        }
        
        if (file_exists($fullPath)) {
            return unlink($fullPath);
        }
        
        return true; // File doesn't exist, consider it deleted
    }
    
    /**
     * Get public URL for uploaded file
     * 
     * @param string $relativePath Relative path from UPLOAD_DIR
     * @return string Public URL
     */
    public static function getUrl(string $relativePath): string {
        if (empty($relativePath)) {
            return '';
        }
        
        return UPLOAD_URL . $relativePath;
    }

    /**
     * Transform photo path to full URL
     *
     * @param string|null $photo Photo path (relative or full URL)
     * @return string|null Full URL or null
     */
    public static function transformPhotoUrl(?string $photo): ?string {
        if (!$photo) return null;
        // If already a full URL, return as-is
        if (filter_var($photo, FILTER_VALIDATE_URL)) return $photo;
        // Convert relative path to full URL
        return UPLOAD_URL . $photo;
    }
}
