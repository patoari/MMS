<?php
/**
 * Application base URL — auto-detected from the request.
 *
 * Works for setups like:
 *   http://localhost/madrasah/backend/   → APP_BASE_URL = http://localhost/madrasah
 *   http://localhost/backend/            → APP_BASE_URL = http://localhost
 *   https://yourdomain.com/             → APP_BASE_URL = https://yourdomain.com
 *
 * Override by setting the environment variable APP_BASE_URL if auto-detection fails.
 */

if (!defined('APP_BASE_URL')) {
    // Check for environment variable first
    $envBaseUrl = getenv('APP_BASE_URL');
    if ($envBaseUrl) {
        define('APP_BASE_URL', rtrim($envBaseUrl, '/'));
    } else {
        // Auto-detect from request
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';

        // Path to this file: /path/to/project/backend/config/app.php
        // Project root is two levels up from here
        $projectRoot = dirname(__DIR__, 2); // e.g. /var/www/html/madrasah

        // Derive the web path to the project root from DOCUMENT_ROOT
        $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
        if ($docRoot && strpos($projectRoot, $docRoot) === 0) {
            $webPath = str_replace($docRoot, '', $projectRoot);
        } else {
            // Fallback: strip /backend from SCRIPT_NAME
            $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/backend/index.php';
            $scriptDir = dirname(dirname($scriptName));
            $webPath   = rtrim($scriptDir, '/');
        }

        define('APP_BASE_URL', $scheme . '://' . $host . $webPath);
    }
}

// Filesystem path to public/uploads/
define('UPLOAD_DIR', dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR);

// Public URL for uploads
define('UPLOAD_URL', APP_BASE_URL . '/public/uploads/');
