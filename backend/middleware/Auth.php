<?php
require_once __DIR__ . '/../config/jwt.php';
require_once __DIR__ . '/../helpers/Response.php';

class Auth {
    public static function user(): ?array {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/Bearer\s+(.+)/i', $header, $m)) return null;
        return JWT::decode($m[1]);
    }

    public static function require(): array {
        $user = self::user();
        if (!$user) Response::error('Unauthorized', 401);
        return $user;
    }

    public static function requireRole(string ...$roles): array {
        $user = self::require();
        if (!in_array($user['role'], $roles)) Response::error('Forbidden', 403);
        return $user;
    }
}
