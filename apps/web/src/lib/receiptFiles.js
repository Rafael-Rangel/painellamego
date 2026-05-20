/** Alinhado ao maxCount de receipts em apps/api/src/routes/purchases.js */
export const MAX_RECEIPT_FILES = 12;

export function receiptFileKey(f) {
  return `${f?.name || ""}:${f?.size}:${f?.lastModified}`;
}

export function mergeUniqueReceiptFiles(existing, incoming, max = MAX_RECEIPT_FILES) {
  const keys = new Set((existing || []).map(receiptFileKey));
  const next = [...(existing || [])];
  let skipped = 0;
  for (const f of Array.from(incoming || []).filter(Boolean)) {
    const k = receiptFileKey(f);
    if (keys.has(k)) continue;
    if (next.length >= max) {
      skipped += 1;
      continue;
    }
    keys.add(k);
    next.push(f);
  }
  return { files: next, skipped };
}
