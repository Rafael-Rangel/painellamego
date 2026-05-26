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
