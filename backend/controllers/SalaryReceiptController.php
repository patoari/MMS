<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../helpers/PrefixHelper.php';
require_once __DIR__ . '/../helpers/ReceiptHelper.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SalaryReceiptController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    // GET /salary-receipts - List all receipts with optional filters
    public function index(): void {
        Auth::requireRole('admin', 'accountant');
        $search = $_GET['search'] ?? '';
        $month = $_GET['month'] ?? '';
        
        $where = ['1=1'];
        $params = [];
        
        if ($search) {
            $where[] = '(pr.receipt_number LIKE ? OR pr.teacher_name LIKE ?)';
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        if ($month) {
            $where[] = 'pr.month = ?';
            $params[] = $month;
        }
        
        $stmt = $this->db->prepare("
            SELECT pr.*, u.name as created_by_name 
            FROM salary_payment_receipts pr
            LEFT JOIN users u ON u.id = pr.created_by
            WHERE " . implode(' AND ', $where) . "
            ORDER BY pr.created_at DESC
        ");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    // GET /salary-receipts/:id - Get single receipt
    public function show(string $id): void {
        Auth::requireRole('admin', 'accountant');
        $stmt = $this->db->prepare("
            SELECT pr.*, u.name as created_by_name,
                   t.phone, t.email, t.subject, t.address
            FROM salary_payment_receipts pr
            LEFT JOIN users u ON u.id = pr.created_by
            LEFT JOIN teachers t ON t.id = pr.teacher_id
            WHERE pr.id = ? OR pr.receipt_number = ?
        ");
        $stmt->execute([$id, $id]);
        $row = $stmt->fetch();
        if (!$row) Response::error('Receipt not found', 404);
        Response::success($row);
    }

    // POST /salary-receipts - Create new receipt when salary is paid
    public function store(): void {
        Auth::requireRole('admin', 'accountant');
        $body = json_decode(file_get_contents('php://input'), true);
        
        foreach (['salary_id', 'teacher_id', 'teacher_name', 'month', 'amount'] as $f) {
            if (empty($body[$f])) Response::error("Field '$f' required");
        }

        // Generate unique receipt ID and number
        $receiptPrefix = PrefixHelper::receipt($this->db);
        $receiptId = IdGenerator::generate($this->db, 'salary_payment_receipts', $receiptPrefix, false);
        $receiptNumber = ReceiptHelper::generateReceiptNumber($this->db);
        
        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $paymentDate = $body['payment_date'] ?? date('Y-m-d');
        
        $this->db->prepare("
            INSERT INTO salary_payment_receipts 
            (id, receipt_number, salary_id, teacher_id, teacher_name, month, 
             amount, payment_method, payment_date, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $receiptId,
            $receiptNumber,
            $body['salary_id'],
            $body['teacher_id'],
            $body['teacher_name'],
            $body['month'],
            $body['amount'],
            $body['payment_method'] ?? 'নগদ',
            $paymentDate,
            $body['remarks'] ?? null,
            $user['id'] ?? null
        ]);
        
        Response::success([
            'id' => $receiptId,
            'receipt_number' => $receiptNumber
        ], 'Receipt created', 201);
    }

    // GET /salary-receipts/search/:receiptNumber - Search by receipt number
    public function search(string $receiptNumber): void {
        Auth::requireRole('admin', 'accountant');
        $stmt = $this->db->prepare("
            SELECT pr.*, u.name as created_by_name,
                   t.phone, t.email, t.subject, t.address
            FROM salary_payment_receipts pr
            LEFT JOIN users u ON u.id = pr.created_by
            LEFT JOIN teachers t ON t.id = pr.teacher_id
            WHERE pr.receipt_number = ?
        ");
        $stmt->execute([$receiptNumber]);
        $row = $stmt->fetch();
        if (!$row) Response::error('Receipt not found', 404);
        Response::success($row);
    }
}
