<?php
declare(strict_types=1);

// CORS
$allowedOrigins = [
    'https://dhamalkot.proqoder.com',
    'http://localhost:5173',
    'http://localhost:3000',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: ' . $allowedOrigins[0]);
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/config/jwt.php';
require_once __DIR__ . '/helpers/Response.php';
require_once __DIR__ . '/middleware/Auth.php';
require_once __DIR__ . '/routes/api.php';

set_exception_handler(function (Throwable $e) {
    Response::error('Server error: ' . $e->getMessage(), 500);
});

$method = $_SERVER['REQUEST_METHOD'];
$uri    = $_SERVER['REQUEST_URI'];

dispatch($method, $uri);
