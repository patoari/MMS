<?php
/**
 * Reads ID prefixes from site_settings table.
 * Falls back to hardcoded defaults if not set.
 *
 * Setting keys (stored in site_settings):
 *   studentIdPrefix  → default: MMS
 *   teacherIdPrefix  → default: TCH
 *   receiptIdPrefix  → default: RCP
 */
class PrefixHelper {

    private static array $defaults = [
        'studentIdPrefix' => 'MMS',
        'teacherIdPrefix' => 'TCH',
        'receiptIdPrefix' => 'RCP',
    ];

    public static function get(PDO $db, string $key): string {
        $stmt = $db->prepare("SELECT setting_value FROM site_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        // Strip anything that isn't alphanumeric or dash
        $val = $val ? preg_replace('/[^A-Za-z0-9\-]/', '', strtoupper(trim($val))) : '';
        return $val ?: (self::$defaults[$key] ?? strtoupper($key));
    }

    public static function student(PDO $db): string { return self::get($db, 'studentIdPrefix'); }
    public static function teacher(PDO $db): string { return self::get($db, 'teacherIdPrefix'); }
    public static function receipt(PDO $db): string { return self::get($db, 'receiptIdPrefix'); }
}
