// Generate receipt number with date and random suffix
export function generateReceiptNo(prefix = 'RCP') {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${rand}`;
}

// Safe array check helper
export function safeArray(data) {
  return Array.isArray(data) ? data : [];
}
