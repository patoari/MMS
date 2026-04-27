<?php
/**
 * SECURITY WARNING: This file should be deleted after initial setup!
 * Run once: php backend/setup.php
 * Creates the default admin user with a hashed password.
 * 
 * For security, this file will only run if accessed via CLI or if SETUP_ENABLED is true in .env
 */

// Security check: Only allow CLI execution or if explicitly enabled
if (php_sapi_name() !== 'cli') {
    // Check if setup is enabled in environment
    $envFile = __DIR__ . '/../.env';
    $setupEnabled = false;
    
    if (file_exists($envFile)) {
        $envContent = file_get_contents($envFile);
        if (preg_match('/SETUP_ENABLED\s*=\s*true/i', $envContent)) {
            $setupEnabled = true;
        }
    }
    
    if (!$setupEnabled) {
        http_response_code(403);
        die('Setup is disabled. To enable, add SETUP_ENABLED=true to your .env file, or run via CLI: php backend/setup.php');
    }
}

require_once __DIR__ . '/config/database.php';

try {
    $db   = Database::connect();
    $hash = password_hash('admin123', PASSWORD_BCRYPT);

    $stmt = $db->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')
                          ON DUPLICATE KEY UPDATE password = VALUES(password)");
    $stmt->execute(['প্রধান শিক্ষক', 'admin@madrasah.edu', $hash]);

    echo "✓ Admin user created successfully.\n";
    echo "Email:    admin@madrasah.edu\n";
    echo "Password: admin123\n";
    echo "\n";
    echo "⚠️  IMPORTANT SECURITY STEPS:\n";
    echo "1. Change the password immediately after first login!\n";
    echo "2. Delete this setup.php file or set SETUP_ENABLED=false in .env\n";
    echo "3. Never commit .env file to version control\n";
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

