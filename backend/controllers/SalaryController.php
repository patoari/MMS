<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/IdGenerator.php';
require_once __DIR__ . '/../helpers/PrefixHelper.php';
require_once __DIR__ . '/../helpers/ReceiptHelper.php';
require_once __DIR__ . '/../middleware/Auth.php';

class SalaryController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        Auth::requireRole('admin', 'accountant');
        $month = $_GET['month'] ?? '';
        $where = ['1=1']; $params = [];
        if ($month) { $where[] = 's.month = ?'; $params[] = $month; }

        $stmt = $this->db->prepare("SELECT s.*, t.name AS teacher_name FROM salaries s JOIN teachers t ON t.id = s.teacher_id WHERE " . implode(' AND ', $where) . " ORDER BY s.created_at DESC");
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::requireRole('admin', 'accountant');
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['teacher_id','month','amount'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");

        // Generate unique ID using IdGenerator helper
        $newId = IdGenerator::generate($this->db, 'salaries', 'SAL', false);

        $this->db->prepare("INSERT INTO salaries (id, teacher_id, month, amount, paid, status) VALUES (?,?,?,?,0,'বকেয়া')")
            ->execute([$newId, $body['teacher_id'], $body['month'], $body['amount']]);
        Response::success(['id' => $newId], 'Salary record created', 201);
    }

    public function pay(string $id): void {
        Auth::requireRole('admin', 'accountant');
        $body = json_decode(file_get_contents('php://input'), true);
        $stmt = $this->db->prepare('SELECT s.*, t.name AS teacher_name FROM salaries s JOIN teachers t ON t.id = s.teacher_id WHERE s.id = ?');
        $stmt->execute([$id]);
        $sal = $stmt->fetch();
        if (!$sal) Response::error('Salary record not found', 404);

        $amount = isset($body['amount']) ? (float)$body['amount'] : ((float)$sal['amount'] - (float)$sal['paid']);
        $newPaid = min((float)$sal['amount'], (float)$sal['paid'] + $amount);
        $status  = $newPaid >= (float)$sal['amount'] ? 'পরিশোধিত' : 'বকেয়া';

        $this->db->prepare("UPDATE salaries SET paid = ?, status = ?, paid_date = CURDATE() WHERE id = ?")
            ->execute([$newPaid, $status, $id]);
        
        // Create payment receipt
        require_once __DIR__ . '/SalaryReceiptController.php';
        $receiptController = new SalaryReceiptController();
        
        // Generate receipt
        $receiptPrefix = PrefixHelper::receipt($this->db);
        $receiptId = IdGenerator::generate($this->db, 'salary_payment_receipts', $receiptPrefix, false);
        $receiptNumber = ReceiptHelper::generateReceiptNumber($this->db);
        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $this->db->prepare("
            INSERT INTO salary_payment_receipts 
            (id, receipt_number, salary_id, teacher_id, teacher_name, month, 
             amount, payment_method, payment_date, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $receiptId,
            $receiptNumber,
            $id,
            $sal['teacher_id'],
            $sal['teacher_name'],
            $sal['month'],
            $amount,
            $body['payment_method'] ?? 'নগদ',
            date('Y-m-d'),
            $body['remarks'] ?? null,
            $user['id'] ?? null
        ]);
        
        Response::success([
            'receipt_id' => $receiptId,
            'receipt_number' => $receiptNumber
        ], 'Salary paid and receipt generated');
    }

    // POST /salaries/generate  { month }
    // Creates salary records for all active teachers for the given month (skips if already exists)
    public function generate(): void {
        Auth::requireRole('admin', 'accountant');
        $body  = json_decode(file_get_contents('php://input'), true);
        $month = trim($body['month'] ?? '');
        if (!$month) Response::error('month required');

        $teachers = $this->db->query("SELECT id, salary FROM teachers WHERE status = 'সক্রিয়'")->fetchAll();
        $created  = 0;

        foreach ($teachers as $t) {
            // Skip if record already exists for this teacher+month
            $exists = $this->db->prepare("SELECT COUNT(*) FROM salaries WHERE teacher_id = ? AND month = ?");
            $exists->execute([$t['id'], $month]);
            if ((int)$exists->fetchColumn() > 0) continue;

            // Generate unique ID using IdGenerator helper
            $newId = IdGenerator::generate($this->db, 'salaries', 'SAL', false);

            $this->db->prepare("INSERT INTO salaries (id, teacher_id, month, amount, paid, status) VALUES (?,?,?,?,0,'বকেয়া')")
                ->execute([$newId, $t['id'], $month, $t['salary']]);
            $created++;
        }

        Response::success(['created' => $created], "$created salary records created");
    }

    public function summary(): void {
        Auth::requireRole('admin', 'accountant');
        $row = $this->db->query("SELECT SUM(paid) AS total_paid, SUM(amount - paid) AS total_due, COUNT(*) AS total FROM salaries")->fetch();
        Response::success($row);
    }
}
