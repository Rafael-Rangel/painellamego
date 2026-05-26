/** Espelho de @lamego/shared/purchaseTotals para o frontend. */

/** Aceita "12,5", "0,02" e booleanos vindos de JSON/API. */
export function parseBrNumber(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  if (!s.length) return NaN;
  return Number(s);
}

/** Evita tratar a string "false" ou "0" como bonificação ativa. */
export function isBonificationOnlyLine(item) {
  const v = item?.isBonificationOnly;
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "no" || s === "nao" || s === "não") return false;
    return s === "true" || s === "1" || s === "yes" || s === "sim";
  }
  return false;
}

export function lineChargeAmount(item) {
  if (isBonificationOnlyLine(item)) return 0;
  const q = parseBrNumber(item?.quantity);
  const p = parseBrNumber(item?.unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

export function lineBonusValue(item) {
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

export function purchaseTotalsFromItems(items = []) {
  let totalPayable = 0;
  let totalBonusValue = 0;
  for (const it of items) {
    totalPayable += lineChargeAmount(it);
    totalBonusValue += lineBonusValue(it);
  }
  return {
    totalPayable: Math.round(totalPayable * 100) / 100,
    totalBonusValue: Math.round(totalBonusValue * 100) / 100
  };
}

export function validateInstallmentsAgainstPayable(installments, totalPayable, tolerance = 0.02) {
  const sum = (installments || []).reduce((s, row) => s + (parseBrNumber(row.amount) || 0), 0);
  const diff = Math.abs(sum - totalPayable);
  return { ok: diff <= tolerance, sum: Math.round(sum * 100) / 100, diff };
}

/** Linha de pré-visualização a partir do formulário (item ainda não adicionado ou em edição). */
export function draftItemToPreviewRow(draftItem) {
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
export function purchaseTotalsWithDraft(items = [], draftItem, editingIndex = null) {
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

export function hasChargeablePurchaseContent(items = []) {
  const { totalPayable, totalBonusValue } = purchaseTotalsFromItems(items);
  return totalPayable > 0 || totalBonusValue > 0;
}

/** Normaliza flag de bonificação vinda de JSON/rascunho (evita string "false" truthy na UI). */
export function normalizePurchaseItemRow(item) {
  if (!item || typeof item !== "object") return item;
  return { ...item, isBonificationOnly: isBonificationOnlyLine(item) };
}

/** Valor exibido na linha: cobrança ou referência de bonificação. */
export function lineDisplayAmount(item) {
  if (isBonificationOnlyLine(item)) return lineBonusValue(item);
  return lineChargeAmount(item);
}
