<?php
class Response {
    /**
     * Sanitize data to prevent XSS attacks
     * 
     * @param mixed $data Data to sanitize
     * @return mixed Sanitized data
     */
    private static function sanitize(mixed $data): mixed {
        if (is_string($data)) {
            return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        }
        
        if (is_array($data)) {
            return array_map([self::class, 'sanitize'], $data);
        }
        
        return $data;
    }
    
    public static function json(mixed $data, int $status = 200, bool $sanitize = false): void {
        http_response_code($status);
        
        // Optionally sanitize data before encoding
        if ($sanitize) {
            $data = self::sanitize($data);
        }
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success(mixed $data = null, string $message = 'success', int $status = 200): void {
        self::json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    public static function error(string $message, int $status = 400): void {
        // Sanitize error messages to prevent XSS
        $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        self::json(['success' => false, 'message' => $message], $status);
    }

    public static function paginate(array $items, int $total, int $page, int $perPage): void {
        self::json([
            'success' => true,
            'data'    => $items,
            'meta'    => ['total' => $total, 'page' => $page, 'per_page' => $perPage, 'last_page' => (int)ceil($total / $perPage)],
        ]);
    }
}
