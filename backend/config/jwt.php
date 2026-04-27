<?php
class JWT {
    private static function getSecret(): string {
        // Try to get secret from environment variable first
        $secret = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? null);
        
        // Fallback to default (should be changed in production)
        if (empty($secret)) {
            error_log('WARNING: Using default JWT secret. Set JWT_SECRET environment variable in production!');
            return 'MMS_JWT_SECRET_CHANGE_IN_PRODUCTION';
        }
        
        return $secret;
    }
    
    private static int $ttl = 86400; // 24 hours

    public static function encode(array $payload): string {
        $header  = self::b64(json_encode(['alg'=>'HS256','typ'=>'JWT']));
        $payload['iat'] = time();
        $payload['exp'] = time() + self::$ttl;
        $body    = self::b64(json_encode($payload));
        $sig     = self::b64(hash_hmac('sha256', "$header.$body", self::getSecret(), true));
        return "$header.$body.$sig";
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $body, $sig] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$header.$body", self::getSecret(), true));
        if (!hash_equals($expected, $sig)) return null;
        $payload = json_decode(self::b64d($body), true);
        if (!$payload || $payload['exp'] < time()) return null;
        return $payload;
    }

    private static function b64(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    private static function b64d(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
