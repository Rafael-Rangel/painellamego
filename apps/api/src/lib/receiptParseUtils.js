import { normalizeUnitUsed } from "./measurementUnits.js";

/** Tolerância relativa para qty × preço ≈ total (2%). */
export const LINE_RECONCILE_TOLERANCE = 0.02;

const UNIT_ALIASES = {
  un: ["un", "unid", "unidade", "und", "pc", "pç", "peca", "peça"],
  kg: ["kg", "kilo", "kilograma", "kilogramas"],
  g: ["g", "gr", "grama", "gramas"],
  l: ["l", "lt", "litro", "litros"],
  ml: ["ml", "mililitro", "mililitros"],
  cx: ["cx", "caixa", "caixas", "cx.", "cxa"],
  pct: ["pct", "pacote", "pac", "pcto"],
  fardo: ["fardo", "fd", "far"],
  saco: ["saco", "sc", "sac"],
  maco: ["maco", "maço", "mç"],
  bdj: ["bdj", "bandeja", "bandejas"]
};

/**
 * Converte número em formato BR (1.930,28 ou 10,52) ou US para float.
 * Aceita number já parseado.
 */
export function parseBrDecimal(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/[R$\s]/gi, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function unitAliasKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Normaliza unidade da nota para código da rede (cx, kg, fardo, etc.).
 */
export function normalizeReceiptUnit(raw, allowedUnits = []) {
  const key = unitAliasKey(raw);
  if (!key) return normalizeUnitUsed("", allowedUnits);

  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(key)) {
      return normalizeUnitUsed(canonical, allowedUnits);
    }
  }

  return normalizeUnitUsed(raw, allowedUnits);
}

function approxEqual(a, b, tolerance = LINE_RECONCILE_TOLERANCE) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(Math.abs(a), Math.abs(b), 0.01);
  return Math.abs(a - b) <= scale * tolerance;
}

/**
 * Reconcilia quantidade, preço unitário e total da linha.
 * @returns {{ quantity, unitPrice, lineTotal, warnings: string[] }}
 */
export function reconcileLineItem({ quantity, unitPrice, lineTotal, tolerance = LINE_RECONCILE_TOLERANCE }) {
  let qty = parseBrDecimal(quantity);
  let price = parseBrDecimal(unitPrice);
  let total = parseBrDecimal(lineTotal);
  const warnings = [];

  const hasQty = Number.isFinite(qty) && qty > 0;
  const hasPrice = Number.isFinite(price) && price > 0;
  const hasTotal = Number.isFinite(total) && total > 0;

  if (hasQty && hasPrice && hasTotal) {
    const expected = qty * price;
    if (!approxEqual(expected, total, tolerance)) {
      warnings.push("total da linha não confere com quantidade × preço unitário");
    }
    return { quantity: qty, unitPrice: price, lineTotal: total, warnings };
  }

  if (hasQty && hasPrice && !hasTotal) {
    total = Math.round(qty * price * 100) / 100;
    return { quantity: qty, unitPrice: price, lineTotal: total, warnings };
  }

  if (hasQty && hasTotal && !hasPrice) {
    price = Math.round((total / qty) * 10000) / 10000;
    return { quantity: qty, unitPrice: price, lineTotal: total, warnings };
  }

  if (hasPrice && hasTotal && !hasQty) {
    qty = Math.round((total / price) * 10000) / 10000;
    return { quantity: qty, unitPrice: price, lineTotal: total, warnings };
  }

  return {
    quantity: hasQty ? qty : null,
    unitPrice: hasPrice ? price : null,
    lineTotal: hasTotal ? total : null,
    warnings
  };
}

/**
 * Normaliza um item bruto vindo do JSON da IA antes do match de produtos.
 */
export function normalizeRawAiItem(it, allowedUnits = []) {
  const reconciled = reconcileLineItem({
    quantity: it?.quantity,
    unitPrice: it?.unitPrice,
    lineTotal: it?.lineTotal
  });

  return {
    productName: String(it?.productName || "").trim() || null,
    productNameNormalized: String(it?.productNameNormalized || it?.productName || "").trim() || null,
    quantity: reconciled.quantity,
    unitPrice: reconciled.unitPrice,
    lineTotal: reconciled.lineTotal,
    unitUsed: it?.unitUsed ? normalizeReceiptUnit(it.unitUsed, allowedUnits) : null,
    notes: it?.notes ? String(it.notes).trim() : null,
    reconcileWarnings: reconciled.warnings
  };
}
