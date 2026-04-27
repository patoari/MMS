<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class TransactionController {
    private PDO $db;
    public function __construct() { $this->db = Database::connect(); }

    public function index(): void {
        Auth::requireRole('admin', 'accountant');
        $type  = $_GET['type']  ?? '';
        $month = $_GET['month'] ?? '';
        $where = ['1=1']; $params = [];
        if ($type)  { $where[] = 'type = ?';                    $params[] = $type; }
        if ($month) { $where[] = "DATE_FORMAT(date,'%Y-%m') = ?"; $params[] = $month; }
        $stmt = $this->db->prepare(
            "SELECT * FROM transactions WHERE " . implode(' AND ', $where) . " ORDER BY date DESC, id DESC"
        );
        $stmt->execute($params);
        Response::success($stmt->fetchAll());
    }

    public function store(): void {
        Auth::requireRole('admin', 'accountant');
        $body = json_decode(file_get_contents('php://input'), true);
        foreach (['type','category','amount','date'] as $f)
            if (empty($body[$f])) Response::error("Field '$f' required");
        if (!in_array($body['type'], ['income','expense'])) Response::error('type must be income or expense');

        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $stmt = $this->db->prepare(
            "INSERT INTO transactions (voucher_no, type, category, amount, description, date, created_by) VALUES (?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $body['voucher_no'] ?? null,
            $body['type'], $body['category'], (float)$body['amount'],
            $body['description'] ?? null, $body['date'], $user['id'],
        ]);
        Response::success(['id' => $this->db->lastInsertId()], 'Transaction saved', 201);
    }

    public function destroy(int $id): void {
        Auth::requireRole('admin', 'accountant');
        $this->db->prepare('DELETE FROM transactions WHERE id = ?')->execute([$id]);
        Response::success(null, 'Deleted');
    }

    public function summary(): void {
        Auth::requireRole('admin', 'accountant');

        // Manual transactions
        $row = $this->db->query("
            SELECT
                SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS total_income,
                SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS total_expense
            FROM transactions
        ")->fetch(PDO::FETCH_ASSOC);

        // Fee income from fees table (excluding archived students)
        $feeRow = $this->db->query("
            SELECT
                SUM(f.paid) AS total_fee_income,
                SUM(CASE WHEN f.category='মাসিক ফি'   THEN f.paid ELSE 0 END) AS monthly_fee,
                SUM(CASE WHEN f.category='ভর্তি ফি'   THEN f.paid ELSE 0 END) AS admission_fee,
                SUM(CASE WHEN f.category='পরীক্ষা ফি' THEN f.paid ELSE 0 END) AS exam_fee,
                SUM(CASE WHEN f.category='সেশন ফি'    THEN f.paid ELSE 0 END) AS session_fee,
                SUM(CASE WHEN f.category NOT IN ('মাসিক ফি','ভর্তি ফি','পরীক্ষা ফি','সেশন ফি') THEN f.paid ELSE 0 END) AS other_fee,
                SUM(f.amount - f.paid) AS fee_due
            FROM fees f
            JOIN students s ON s.id = f.student_id
            WHERE s.deleted_at IS NULL
        ")->fetch(PDO::FETCH_ASSOC);

        // Salary expense from salaries table
        $salRow = $this->db->query("
            SELECT
                SUM(paid)   AS total_salary_paid,
                SUM(amount) AS total_salary_billed,
                SUM(CASE WHEN status='বকেয়া' THEN amount-paid ELSE 0 END) AS salary_due
            FROM salaries
        ")->fetch(PDO::FETCH_ASSOC);

        // Combined totals
        $totalIncome  = (float)($row['total_income']  ?? 0) + (float)($feeRow['total_fee_income'] ?? 0);
        $totalExpense = (float)($row['total_expense'] ?? 0) + (float)($salRow['total_salary_paid'] ?? 0);
        $net          = $totalIncome - $totalExpense;

        // All income categories (fees + manual)
        $incomeCategories = [];
        // Fee categories
        foreach ([
            'মাসিক ফি'   => $feeRow['monthly_fee'],
            'ভর্তি ফি'   => $feeRow['admission_fee'],
            'পরীক্ষা ফি' => $feeRow['exam_fee'],
            'সেশন ফি'    => $feeRow['session_fee'],
            'অন্যান্য ফি' => $feeRow['other_fee'],
        ] as $cat => $amt) {
            if ((float)$amt > 0) $incomeCategories[] = ['category' => $cat, 'total' => (float)$amt, 'source' => 'fee'];
        }
        // Manual income categories
        $manualIncome = $this->db->query("
            SELECT category, SUM(amount) AS total FROM transactions WHERE type='income' GROUP BY category ORDER BY total DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($manualIncome as $r) {
            $incomeCategories[] = ['category' => $r['category'], 'total' => (float)$r['total'], 'source' => 'manual'];
        }
        usort($incomeCategories, fn($a,$b) => $b['total'] <=> $a['total']);

        // All expense categories (salaries + manual)
        $expenseCategories = [['category' => 'শিক্ষক বেতন', 'total' => (float)($salRow['total_salary_paid'] ?? 0), 'source' => 'salary']];
        $manualExpense = $this->db->query("
            SELECT category, SUM(amount) AS total FROM transactions WHERE type='expense' GROUP BY category ORDER BY total DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($manualExpense as $r) {
            $expenseCategories[] = ['category' => $r['category'], 'total' => (float)$r['total'], 'source' => 'manual'];
        }
        usort($expenseCategories, fn($a,$b) => $b['total'] <=> $a['total']);

        // Monthly trend (fees + manual transactions combined)
        $feeTrend = $this->db->query("
            SELECT DATE_FORMAT(paid_date,'%Y-%m') AS month_key, SUM(paid) AS income, 0 AS expense
            FROM fees WHERE paid_date IS NOT NULL AND paid_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month_key
        ")->fetchAll(PDO::FETCH_ASSOC);

        $txnTrend = $this->db->query("
            SELECT DATE_FORMAT(date,'%Y-%m') AS month_key,
                   SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
                   SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
            FROM transactions WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month_key
        ")->fetchAll(PDO::FETCH_ASSOC);

        $salTrend = $this->db->query("
            SELECT DATE_FORMAT(paid_date,'%Y-%m') AS month_key, 0 AS income, SUM(paid) AS expense
            FROM salaries WHERE paid_date IS NOT NULL AND paid_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month_key
        ")->fetchAll(PDO::FETCH_ASSOC);

        $trendMap = [];
        foreach (array_merge($feeTrend, $txnTrend, $salTrend) as $r) {
            $k = $r['month_key'];
            if (!isset($trendMap[$k])) $trendMap[$k] = ['month_key' => $k, 'income' => 0, 'expense' => 0];
            $trendMap[$k]['income']  += (float)$r['income'];
            $trendMap[$k]['expense'] += (float)$r['expense'];
        }
        ksort($trendMap);
        $trend = array_values($trendMap);

        Response::success([
            'total_income'       => $totalIncome,
            'total_expense'      => $totalExpense,
            'net'                => $net,
            'fee_due'            => (float)($feeRow['fee_due'] ?? 0),
            'salary_due'         => (float)($salRow['salary_due'] ?? 0),
            'income_categories'  => $incomeCategories,
            'expense_categories' => $expenseCategories,
            'trend'              => $trend,
        ]);
    }

    // GET /transactions/monthly-report?month=YYYY-MM&month_bn=জানুয়ারি&year_bn=২০২৬&year_en=2026
    public function monthlyReport(): void {
        Auth::requireRole('admin', 'accountant');
        $month   = $_GET['month']    ?? date('Y-m');   // e.g. 2026-01 (for transactions/salaries date filter)
        $monthBn = $_GET['month_bn'] ?? '';             // e.g. জানুয়ারি
        $yearBn  = $_GET['year_bn']  ?? '';             // e.g. ২০২৬
        $yearEn  = $_GET['year_en']  ?? substr($month, 0, 4); // e.g. 2026

        // Fee income — match by ACTUAL PAYMENT DATE (paid_date), not billing period (month field)
        // This ensures January fees paid in April show as April income
        $feeStmt = $this->db->prepare("
            SELECT category, SUM(paid) AS total
            FROM fees
            WHERE paid > 0
              AND paid_date IS NOT NULL
              AND DATE_FORMAT(paid_date, '%Y-%m') = ?
            GROUP BY category ORDER BY total DESC
        ");
        $feeStmt->execute([$month]);
        $feeRows = $feeStmt->fetchAll(PDO::FETCH_ASSOC);

        // Manual income for this month (by transaction date)
        $manIncome = $this->db->prepare("
            SELECT category, SUM(amount) AS total, GROUP_CONCAT(description SEPARATOR ', ') AS detail,
                   GROUP_CONCAT(DISTINCT voucher_no SEPARATOR ', ') AS voucher_nos
            FROM transactions WHERE type='income' AND DATE_FORMAT(date,'%Y-%m') = ?
            GROUP BY category ORDER BY total DESC
        ");
        $manIncome->execute([$month]);
        $manIncomeRows = $manIncome->fetchAll(PDO::FETCH_ASSOC);

        // Salary expense — match by ACTUAL PAYMENT DATE (paid_date), not billing period (month field)
        // This ensures January salary paid in April shows as April expense
        $salStmt = $this->db->prepare("
            SELECT 'শিক্ষক বেতন' AS category, SUM(s.paid) AS total,
                   GROUP_CONCAT(CONCAT(t.name,' (',s.paid,')') SEPARATOR ', ') AS detail
            FROM salaries s JOIN teachers t ON t.id = s.teacher_id
            WHERE s.paid > 0
              AND s.paid_date IS NOT NULL
              AND DATE_FORMAT(s.paid_date, '%Y-%m') = ?
        ");
        $salStmt->execute([$month]);
        $salRow = $salStmt->fetch(PDO::FETCH_ASSOC);

        // Manual expense for this month
        $manExpense = $this->db->prepare("
            SELECT category, SUM(amount) AS total, GROUP_CONCAT(description SEPARATOR ', ') AS detail,
                   GROUP_CONCAT(DISTINCT voucher_no SEPARATOR ', ') AS voucher_nos
            FROM transactions WHERE type='expense' AND DATE_FORMAT(date,'%Y-%m') = ?
            GROUP BY category ORDER BY total DESC
        ");
        $manExpense->execute([$month]);
        $manExpenseRows = $manExpense->fetchAll(PDO::FETCH_ASSOC);

        // Previous cumulative balance — all fees/salaries/transactions before this month
        // Use month field for fees and salaries, date field for transactions
        $prevFeeIncomeStmt = $this->db->prepare("
            SELECT COALESCE(SUM(paid),0) FROM fees
            WHERE paid > 0 AND paid_date IS NOT NULL AND DATE_FORMAT(paid_date,'%Y-%m') < ?
        ");
        $prevFeeIncomeStmt->execute([$month]);
        $prevFeeIncome = (float)$prevFeeIncomeStmt->fetchColumn();

        $prevManIncomeStmt = $this->db->prepare("
            SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income' AND DATE_FORMAT(date,'%Y-%m') < ?
        ");
        $prevManIncomeStmt->execute([$month]);
        $prevManIncome = (float)$prevManIncomeStmt->fetchColumn();

        $prevSalaryStmt = $this->db->prepare("
            SELECT COALESCE(SUM(paid),0) FROM salaries WHERE paid > 0 AND paid_date IS NOT NULL AND DATE_FORMAT(paid_date,'%Y-%m') < ?
        ");
        $prevSalaryStmt->execute([$month]);
        $prevSalary = (float)$prevSalaryStmt->fetchColumn();

        $prevManExpStmt = $this->db->prepare("
            SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense' AND DATE_FORMAT(date,'%Y-%m') < ?
        ");
        $prevManExpStmt->execute([$month]);
        $prevManExp = (float)$prevManExpStmt->fetchColumn();
        $prevBalance = ($prevFeeIncome + $prevManIncome) - ($prevSalary + $prevManExp);

        // Build income list
        $incomeItems = [];
        foreach ($feeRows as $r) {
            if ((float)$r['total'] > 0)
                $incomeItems[] = ['label' => $r['category'], 'amount' => (float)$r['total'], 'source' => 'fee'];
        }
        foreach ($manIncomeRows as $r) {
            if ((float)$r['total'] > 0)
                $incomeItems[] = ['label' => $r['category'], 'amount' => (float)$r['total'], 'detail' => $r['detail'], 'voucher_nos' => $r['voucher_nos'] ?? null, 'source' => 'manual'];
        }

        // Build expense list
        $expenseItems = [];
        if ($salRow && (float)$salRow['total'] > 0)
            $expenseItems[] = ['label' => 'শিক্ষক ও কর্মচারী বেতন', 'amount' => (float)$salRow['total'], 'source' => 'salary'];
        foreach ($manExpenseRows as $r) {
            if ((float)$r['total'] > 0)
                $expenseItems[] = ['label' => $r['category'], 'amount' => (float)$r['total'], 'detail' => $r['detail'], 'voucher_nos' => $r['voucher_nos'] ?? null, 'source' => 'manual'];
        }

        $totalIncome  = array_sum(array_column($incomeItems,  'amount'));
        $totalExpense = array_sum(array_column($expenseItems, 'amount'));
        $netThisMonth = $totalIncome - $totalExpense;

        Response::success([
            'month'              => $month,
            'income_items'       => $incomeItems,
            'expense_items'      => $expenseItems,
            'total_income'       => $totalIncome,
            'total_expense'      => $totalExpense,
            'net_this_month'     => $netThisMonth,
            'prev_balance'       => $prevBalance,
            'cumulative_balance' => $prevBalance + $netThisMonth,
        ]);
    }
    public function ledger(): void {
        Auth::requireRole('admin', 'accountant');

        // Fee income rows
        $fees = $this->db->query("
            SELECT 'income' AS type, category, paid AS amount, paid_date AS date,
                   CONCAT(student_id,' - ',month) AS description, 'fee' AS source
            FROM fees WHERE paid > 0 AND paid_date IS NOT NULL
            ORDER BY paid_date DESC LIMIT 200
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Salary expense rows
        $sals = $this->db->query("
            SELECT 'expense' AS type, 'শিক্ষক বেতন' AS category, paid AS amount,
                   paid_date AS date, CONCAT(t.name,' - ',s.month) AS description, 'salary' AS source
            FROM salaries s JOIN teachers t ON t.id = s.teacher_id
            WHERE s.paid > 0 AND s.paid_date IS NOT NULL
            ORDER BY s.paid_date DESC LIMIT 200
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Manual transactions
        $manual = $this->db->query("
            SELECT type, category, amount, date, description, voucher_no, 'manual' AS source
            FROM transactions ORDER BY date DESC, id DESC LIMIT 200
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Merge and sort by date desc
        $all = array_merge($fees, $sals, $manual);
        usort($all, fn($a,$b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));

        Response::success(array_slice($all, 0, 300));
    }
}
