<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../middleware/Auth.php';

class HolidayController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
        $this->ensureTable();
    }

    private function ensureTable(): void {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS `holidays` (
              `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
              `date` date NOT NULL,
              `title` varchar(255) NOT NULL,
              `type` enum('holiday','event') NOT NULL DEFAULT 'holiday',
              `created_by` int(10) UNSIGNED DEFAULT NULL,
              `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (`id`),
              UNIQUE KEY `unique_date` (`date`),
              KEY `idx_date` (`date`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    // GET /holidays?month=2026-04  OR  /holidays?from=2026-04-01&to=2026-04-30
    public function index(): void {
        $month = $_GET['month'] ?? null;
        $from  = $_GET['from']  ?? null;
        $to    = $_GET['to']    ?? null;

        if ($month) {
            $stmt = $this->db->prepare('SELECT * FROM holidays WHERE date LIKE ? ORDER BY date');
            $stmt->execute([$month . '%']);
        } elseif ($from && $to) {
            $stmt = $this->db->prepare('SELECT * FROM holidays WHERE date BETWEEN ? AND ? ORDER BY date');
            $stmt->execute([$from, $to]);
        } else {
            // Return current year
            $stmt = $this->db->prepare('SELECT * FROM holidays WHERE YEAR(date) = ? ORDER BY date');
            $stmt->execute([date('Y')]);
        }

        $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Also generate all Fridays for the requested range and mark them
        $fridays = $this->getFridaysInRange($month, $from, $to);

        Response::success([
            'holidays' => $holidays,
            'fridays'  => $fridays,
        ]);
    }

    // POST /holidays  { date, title, type }
    public function store(): void {
        Auth::requireRole('admin');
        $user = Auth::user();
        if (!$user || !isset($user['id'])) Response::error('Authentication required', 401);
        
        $body = json_decode(file_get_contents('php://input'), true);

        $date  = $body['date']  ?? '';
        $title = trim($body['title'] ?? '');
        $type  = $body['type']  ?? 'holiday';

        if (!$date || !$title) Response::error('date and title required');
        if (!in_array($type, ['holiday', 'event'])) $type = 'holiday';

        // Prevent adding Friday (auto-holiday)
        if (date('N', strtotime($date)) == 5) {
            Response::error('শুক্রবার স্বয়ংক্রিয়ভাবে ছুটির দিন হিসেবে গণ্য হয়');
        }

        try {
            $stmt = $this->db->prepare(
                'INSERT INTO holidays (date, title, type, created_by) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title = VALUES(title), type = VALUES(type)'
            );
            $stmt->execute([$date, $title, $type, $user['id']]);
            Response::success(['message' => 'Holiday saved', 'date' => $date]);
        } catch (Exception $e) {
            Response::error('Failed: ' . $e->getMessage());
        }
    }

    // DELETE /holidays/{date}
    public function destroy(string $date): void {
        Auth::requireRole('admin');
        $stmt = $this->db->prepare('DELETE FROM holidays WHERE date = ?');
        $stmt->execute([$date]);
        Response::success(['message' => 'Holiday removed']);
    }

    // GET /holidays/check?date=2026-04-19
    public function check(): void {
        $date = $_GET['date'] ?? date('Y-m-d');

        // Friday check
        if (date('N', strtotime($date)) == 5) {
            Response::success(['is_holiday' => true, 'title' => 'শুক্রবার', 'type' => 'friday']);
            return;
        }

        $stmt = $this->db->prepare('SELECT * FROM holidays WHERE date = ?');
        $stmt->execute([$date]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        Response::success([
            'is_holiday' => (bool)$row,
            'title'      => $row['title'] ?? null,
            'type'       => $row['type']  ?? null,
        ]);
    }

    // Helper: get all Fridays in a range
    private function getFridaysInRange(?string $month, ?string $from, ?string $to): array {
        if ($month) {
            $from = $month . '-01';
            $to   = date('Y-m-t', strtotime($from));
        } elseif (!$from || !$to) {
            $from = date('Y-01-01');
            $to   = date('Y-12-31');
        }

        $fridays = [];
        $current = strtotime($from);
        $end     = strtotime($to);

        while ($current <= $end) {
            if (date('N', $current) == 5) {
                $fridays[] = date('Y-m-d', $current);
            }
            $current = strtotime('+1 day', $current);
        }

        return $fridays;
    }

    // Static helper used by AttendanceController
    public static function getHolidayDatesInMonth(PDO $db, string $month): array {
        // Declared holidays
        try {
            $stmt = $db->prepare('SELECT date FROM holidays WHERE date LIKE ?');
            $stmt->execute([$month . '%']);
            $declared = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'date');
        } catch (Exception $e) {
            $declared = [];
        }

        // All Fridays in month
        $from    = $month . '-01';
        $to      = date('Y-m-t', strtotime($from));
        $current = strtotime($from);
        $end     = strtotime($to);
        $fridays = [];
        while ($current <= $end) {
            if (date('N', $current) == 5) $fridays[] = date('Y-m-d', $current);
            $current = strtotime('+1 day', $current);
        }

        return array_unique(array_merge($declared, $fridays));
    }

    // Static: check if a single date is holiday
    public static function isHoliday(PDO $db, string $date): bool {
        if (date('N', strtotime($date)) == 5) return true;
        try {
            $stmt = $db->prepare('SELECT id FROM holidays WHERE date = ?');
            $stmt->execute([$date]);
            return (bool)$stmt->fetch();
        } catch (Exception $e) {
            return false;
        }
    }
}
