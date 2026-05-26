export function gatherReceiptFiles(filesObj = {}) {
  const many = Array.isArray(filesObj.receipts) ? filesObj.receipts : [];
  const single = Array.isArray(filesObj.receipt) ? filesObj.receipt : [];
  return [...many, ...single];
}

export function normalizePurchaseDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
