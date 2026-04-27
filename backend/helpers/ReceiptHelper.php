<?php
/**
 * Receipt Helper
 * Shared receipt number generation logic
 */
require_once __DIR__ . '/../helpers/PrefixHelper.php';

class ReceiptHelper {
    /**
     * Generate unique receipt number in format: {PREFIX}-YYYYMMDD-XXX
     * 
     * @param PDO $db Database connection
     * @param string $table Table name (e.g., 'salary_payment_receipts', 'fee_receipts')
     * @param string $column Column name for receipt number (default: 'receipt_number')
     * @return string Unique receipt number
     */
    public static function generateReceiptNumber(PDO $db, string $table = 'salary_payment_receipts', string $column = 'receipt_number'): string {
        $prefix = PrefixHelper::receipt($db);
        $date = date('Ymd');
        $prefixPattern = "$prefix-$date-";
        
        $stmt = $db->prepare(
            "SELECT $column FROM $table
             WHERE $column LIKE ? ORDER BY $column DESC LIMIT 1"
        );
        $stmt->execute(["$prefixPattern%"]);
        $last = $stmt->fetchColumn();
        
        $seq = $last ? (int)substr($last, -3) + 1 : 1;
        return $prefixPattern . str_pad($seq, 3, '0', STR_PAD_LEFT);
    }
}
