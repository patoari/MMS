/**
 * Date formatting utilities
 * Converts dates to DD-MM-YYYY format for display
 */

/**
 * Format date from YYYY-MM-DD to DD-MM-YYYY
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Date in DD-MM-YYYY format
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  // Handle both YYYY-MM-DD and ISO datetime formats
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return dateString;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
};

/**
 * Convert English numerals to Bengali numerals — disabled, returns as-is
 */
export const toBengaliNumerals = (str) => {
  if (!str) return '';
  return String(str);
};

/**
 * Format date to Bengali format — now returns standard DD-MM-YYYY
 */
export const formatDateBengali = (dateString) => {
  return formatDate(dateString);
};

/**
 * Format datetime to DD-MM-YYYY HH:MM format
 * @param {string} dateTimeString - DateTime string
 * @returns {string} Formatted datetime
 */
export const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return '';
  
  const date = new Date(dateTimeString);
  
  if (isNaN(date.getTime())) return dateTimeString;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

/**
 * Get current date in DD-MM-YYYY format
 * @returns {string} Current date
 */
export const getCurrentDate = () => {
  return formatDate(new Date().toISOString());
};

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD for API/database
 * @param {string} dateString - Date in DD-MM-YYYY format
 * @returns {string} Date in YYYY-MM-DD format
 */
export const toISODate = (dateString) => {
  if (!dateString) return '';
  
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
};
