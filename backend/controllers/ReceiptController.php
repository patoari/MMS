<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class ReceiptController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        Auth::require();
        $studentId = $_GET['student_id'] ?? '';
        if ($studentId) {
            $stmt = $this->db->prepare('SELECT * FROM payment_receipts WHERE student_id = ? ORDER BY created_at DESC');
            $stmt->execute([$studentId]);
        } else {
            $stmt = $this->db->query('SELECT * FROM payment_receipts ORDER BY created_at DESC');
        }
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::require();
        $body = json_decode(file_get_contents('php://input'), true);
        if (empty($body['receipt_no'])) Response::error('receipt_no required');

        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $stmt = $this->db->prepare("
            INSERT INTO payment_receipts
              (receipt_no, fee_id, student_id, student_name, student_class,
               guardian, phone, category, month, paid_amount, total_amount,
               total_paid, line_items, total_this_paid, collected_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE total_this_paid = VALUES(total_this_paid)
        ");
        $stmt->execute([
            $body['receipt_no'],
            $body['fee_id']        ?? null,
            $body['student_id']    ?? null,
            $body['student_name']  ?? null,
            $body['student_class'] ?? null,
            $body['guardian']      ?? null,
            $body['phone']         ?? null,
            $body['category']      ?? '',
            $body['month']         ?? '',
            $body['paid_amount']   ?? 0,
            $body['total_amount']  ?? 0,
            $body['total_paid']    ?? 0,
            $body['line_items']    ?? null,
            $body['total_this_paid'] ?? 0,
            $user['id'] ?? null,
        ]);
        Response::success(['receipt_no' => $body['receipt_no']], 'Receipt saved', 201);
    }

    public function show(string $receiptNo): void {
        Auth::require();
        $stmt = $this->db->prepare('SELECT * FROM payment_receipts WHERE receipt_no = ?');
        $stmt->execute([$receiptNo]);
        $row = $stmt->fetch();
        if (!$row) Response::error('Receipt not found', 404);
        if ($row['line_items']) $row['line_items'] = json_decode($row['line_items'], true);
        Response::success($row);
    }
}
