<?php
/**
 * Validation Helper
 * Centralized input validation to eliminate duplicate validation logic
 */

class ValidationHelper {
    /**
     * Validate required fields
     * 
     * @param array $data Input data
     * @param array $required Required field names
     * @throws Exception if validation fails
     */
    public static function requireFields(array $data, array $required): void {
        foreach ($required as $field) {
            if (!isset($data[$field]) || trim($data[$field]) === '') {
                throw new Exception("Field '$field' is required");
            }
        }
    }
    
    /**
     * Validate email format
     * 
     * @param string $email Email address
     * @return bool
     */
    public static function isValidEmail(string $email): bool {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    /**
     * Validate phone number (Bangladesh format)
     * 
     * @param string $phone Phone number
     * @return bool
     */
    public static function isValidPhone(string $phone): bool {
        // Remove spaces and dashes
        $phone = preg_replace('/[\s\-]/', '', $phone);
        
        // Bangladesh phone: 11 digits starting with 01
        return preg_match('/^01[0-9]{9}$/', $phone) === 1;
    }
    
    /**
     * Validate positive amount
     * 
     * @param mixed $amount Amount value
     * @param float $max Maximum allowed amount (optional)
     * @return bool
     */
    public static function isValidAmount($amount, float $max = PHP_FLOAT_MAX): bool {
        $amount = (float)$amount;
        return $amount > 0 && $amount <= $max;
    }
    
    /**
     * Validate date format (Y-m-d)
     * 
     * @param string $date Date string
     * @return bool
     */
    public static function isValidDate(string $date): bool {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    /**
     * Sanitize string input (prevent XSS)
     * 
     * @param string $input Input string
     * @return string Sanitized string
     */
    public static function sanitize(string $input): string {
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * Validate integer within range
     * 
     * @param mixed $value Value to validate
     * @param int $min Minimum value
     * @param int $max Maximum value
     * @return bool
     */
    public static function isValidInt($value, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): bool {
        if (!is_numeric($value)) {
            return false;
        }
        
        $int = (int)$value;
        return $int >= $min && $int <= $max;
    }
    
    /**
     * Validate and sanitize array of allowed values
     * 
     * @param mixed $value Value to check
     * @param array $allowed Allowed values
     * @return bool
     */
    public static function isAllowedValue($value, array $allowed): bool {
        return in_array($value, $allowed, true);
    }
}
