<?php
class Database {
    private static ?PDO $conn = null;

    // Database configuration - should be moved to environment variables in production
    private static string $host = 'localhost';
    private static string $db   = 'proqoder_madrasah_mms';
    private static string $user = 'proqoder_common';
    private static string $pass = '123Common$%^';
    private static string $charset = 'utf8mb4';

    public static function connect(): PDO {
        if (self::$conn === null) {
            // Allow environment variable override for production
            $host = getenv('DB_HOST') ?: self::$host;
            $db = getenv('DB_NAME') ?: self::$db;
            $user = getenv('DB_USER') ?: self::$user;
            $pass = getenv('DB_PASS') ?: self::$pass;
            
            $dsn = "mysql:host=$host;dbname=$db;charset=" . self::$charset;
            self::$conn = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$conn;
    }
}
