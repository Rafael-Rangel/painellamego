/** Aceita "12,5", "0,02" e booleanos vindos de JSON/API. */
export function parseBrNumber(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!s.length) return NaN;
  return Number(s);
}

export function isBonificationOnlyLine(item: { isBonificationOnly?: unknown }) {
  const v = item?.isBonificationOnly;
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "no" || s === "nao" || s === "não") return false;
    return s === "true" || s === "1" || s === "yes" || s === "sim";
  }
  return false;
}

/** Valor cobrado na linha (compra paga). */
export function lineChargeAmount(item: {
  isBonificationOnly?: unknown;
  quantity?: number | string;
  unitPrice?: number | string;
}) {
  if (isBonificationOnlyLine(item)) return 0;
  const q = parseBrNumber(item?.quantity);
  const p = parseBrNumber(item?.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

/** Valor de referência da bonificação na linha. */
export function lineBonusValue(item: {
  isBonificationOnly?: unknown;
  quantity?: number | string;
  unitPrice?: number | string;
  bonusQuantity?: number | string;
  bonusUnitValue?: number | string;
}) {
  const bq = parseBrNumber(item?.bonusQuantity) || 0;
  const bv = parseBrNumber(item?.bonusUnitValue) || 0;
  if (isBonificationOnlyLine(item)) {
    const q = parseBrNumber(item?.quantity) || 0;
    const p = parseBrNumber(item?.unitPrice) || 0;
    if (bq > 0 && bv > 0) return bq * bv;
    if (q > 0 && (p > 0 || bv > 0)) return q * (bv > 0 ? bv : p);
    return bq * bv;
  }
  return bq * bv;
}

export function purchaseTotalsFromItems(items: unknown[] = []) {
  let totalPayable = 0;
  let totalBonusValue = 0;
  for (const it of items) {
    totalPayable += lineChargeAmount(it as Parameters<typeof lineChargeAmount>[0]);
    totalBonusValue += lineBonusValue(it as Parameters<typeof lineBonusValue>[0]);
  }
  return {
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalBonusValue: Math.round(totalBonusValue * 100) / 100
  };
}

export function validateInstallmentsAgainstPayable(
  installments: { amount?: number | string }[] = [],
  totalPayable: number,
  tolerance = 0.02
) {
  const sum = installments.reduce((s, row) => s + (parseBrNumber(row.amount) || 0), 0);
  const diff = Math.abs(sum - totalPayable);
  return { ok: diff <= tolerance, sum: Math.round(sum * 100) / 100, diff };
}

/** Linha de pré-visualização a partir do formulário (item ainda não adicionado ou em edição). */
export function draftItemToPreviewRow(draftItem: Record<string, unknown> | null | undefined) {
  if (!draftItem?.productId) return null;
  const bonusOnly = isBonificationOnlyLine(draftItem);
  const qty = parseBrNumber(draftItem.quantity);
  const price = parseBrNumber(draftItem.unitPrice);
  const bonusQty = parseBrNumber(draftItem.bonusQuantity) || 0;
  const bonusVal = parseBrNumber(draftItem.bonusUnitValue) || 0;

  if (bonusOnly) {
    const effectiveQty = bonusQty > 0 ? bonusQty : qty;
    const effectiveVal = bonusVal > 0 ? bonusVal : price;
    if (!Number.isFinite(effectiveQty) || effectiveQty <= 0) return null;
    return {
      ...draftItem,
      isBonificationOnly: true,
      quantity: String(effectiveQty),
      unitPrice: String(effectiveVal > 0 ? effectiveVal : 0),
      bonusQuantity: String(bonusQty || effectiveQty),
      bonusUnitValue: String(effectiveVal)
    };
  }

  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return null;
  return {
    ...draftItem,
    quantity: String(qty),
    unitPrice: String(price),
    bonusQuantity: String(bonusQty),
    bonusUnitValue: String(bonusVal)
  };
}

/** Total incluindo item do formulário (1 item na nota ou ainda não adicionado). */
export function purchaseTotalsWithDraft(
  items: unknown[] = [],
  draftItem?: Record<string, unknown> | null,
  editingIndex: number | null = null
) {
  const preview = draftItemToPreviewRow(draftItem);
  let rows = [...items];
  if (preview) {
    if (editingIndex != null && editingIndex >= 0 && editingIndex < rows.length) {
      rows = rows.map((row, i) => (i === editingIndex ? preview : row));
    } else if (editingIndex == null) {
      rows = [...rows, preview];
    }
  }
  return purchaseTotalsFromItems(rows);
}

export function hasChargeablePurchaseContent(items: unknown[] = []) {
  const { totalPayable, totalBonusValue } = purchaseTotalsFromItems(items);
  return totalPayable > 0 || totalBonusValue > 0;
}

/** Normaliza flag de bonificação vinda de JSON/rascunho (evita string "false" truthy na UI). */
export function normalizePurchaseItemRow<T extends Record<string, unknown>>(item: T): T {
  if (!item || typeof item !== "object") return item;
  return { ...item, isBonificationOnly: isBonificationOnlyLine(item) };
}

/** Valor exibido na linha: cobrança ou referência de bonificação. */
export function lineDisplayAmount(item: Parameters<typeof lineChargeAmount>[0]) {
  if (isBonificationOnlyLine(item)) return lineBonusValue(item);
  return lineChargeAmount(item);
}
