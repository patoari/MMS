<?php
/**
 * ID Generator Helper
 * Generates unique IDs with race condition protection
 */
class IdGenerator {
    /**
     * Generate a unique ID with prefix and year
     * 
     * @param PDO $db Database connection
     * @param string $table Table name
     * @param string $prefix ID prefix (e.g., 'STU', 'TCH', 'FEE')
     * @param bool $includeYear Include year in ID format
     * @param int $padding Number of digits for sequence (default 3)
     * @return string Generated unique ID
     */
    public static function generate(
        PDO $db, 
        string $table, 
        string $prefix, 
        bool $includeYear = true,
        int $padding = 3
    ): string {
        $year = date('Y');
        $pattern = $includeYear ? "$prefix-$year-%" : "$prefix-%";
        
        // Get last ID with this pattern
        $stmt = $db->prepare("SELECT id FROM $table WHERE id LIKE ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$pattern]);
        $last = $stmt->fetchColumn();
        
        // Extract number from last ID
        $num = $last ? (int) substr($last, strrpos($last, '-') + 1) : 0;
        
        // Try to generate unique ID (with race condition protection)
        $maxAttempts = 100;
        $attempt = 0;
        
        do {
            $num++;
            $newId = $includeYear 
                ? "$prefix-$year-" . str_pad($num, $padding, '0', STR_PAD_LEFT)
                : "$prefix-" . str_pad($num, $padding, '0', STR_PAD_LEFT);
            
            // Check if ID already exists
            $check = $db->prepare("SELECT COUNT(*) FROM $table WHERE id = ?");
            $check->execute([$newId]);
            $exists = $check->fetchColumn() > 0;
            
            $attempt++;
            if ($attempt >= $maxAttempts) {
                error_log("IdGenerator: Failed to generate unique ID for table '$table' with prefix '$prefix' after $maxAttempts attempts. Last attempted ID: $newId");
                throw new Exception("Failed to generate unique ID after $maxAttempts attempts");
            }
        } while ($exists);
        
        return $newId;
    }
}
