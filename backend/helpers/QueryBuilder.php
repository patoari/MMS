<?php
/**
 * Query Builder Helper
 * Eliminates duplicate WHERE clause building and pagination logic
 */

class QueryBuilder {
    /**
     * Build WHERE clause from conditions array
     * 
     * @param array $conditions ['field' => 'value'] or ['field' => ['operator', 'value']]
     * @param array &$params Output parameter array for prepared statements
     * @return string WHERE clause (without WHERE keyword)
     */
    public static function buildWhere(array $conditions, array &$params = []): string {
        $where = [];
        
        foreach ($conditions as $field => $value) {
            if ($value === null) {
                continue; // Skip null values
            }
            
            if (is_array($value)) {
                // ['field' => ['LIKE', '%value%']]
                [$operator, $val] = $value;
                $where[] = "$field $operator ?";
                $params[] = $val;
            } else {
                // ['field' => 'value']
                $where[] = "$field = ?";
                $params[] = $value;
            }
        }
        
        return empty($where) ? '1=1' : implode(' AND ', $where);
    }
    
    /**
     * Build LIKE search conditions for multiple fields
     * 
     * @param string $search Search term
     * @param array $fields Fields to search in
     * @param array &$params Output parameter array
     * @return string WHERE clause part
     */
    public static function buildSearch(string $search, array $fields, array &$params = []): string {
        if (empty($search) || empty($fields)) {
            return '1=1';
        }
        
        $conditions = [];
        $searchTerm = "%$search%";
        
        foreach ($fields as $field) {
            $conditions[] = "$field LIKE ?";
            $params[] = $searchTerm;
        }
        
        return '(' . implode(' OR ', $conditions) . ')';
    }
    
    /**
     * Calculate pagination offset
     * 
     * @param int $page Page number (1-indexed)
     * @param int $limit Items per page
     * @return int Offset value
     */
    public static function getOffset(int $page, int $limit): int {
        return max(0, ($page - 1) * $limit);
    }
    
    /**
     * Validate and sanitize pagination parameters
     * 
     * @param array $params ['page' => x, 'limit' => y]
     * @return array ['page' => int, 'limit' => int, 'offset' => int]
     */
    public static function getPagination(array $params): array {
        $page = max(1, (int)($params['page'] ?? 1));
        $limit = max(1, min(1000, (int)($params['limit'] ?? 50))); // Cap at 1000
        $offset = self::getOffset($page, $limit);
        
        return compact('page', 'limit', 'offset');
    }
}
