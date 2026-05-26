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
