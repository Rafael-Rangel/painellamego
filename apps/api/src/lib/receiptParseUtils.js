import { normalizeUnitUsed, unitCode } from "./measurementUnits.js";

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
  maco: ["maco", "maço", "mç", "ml"],
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

/** Tolerância só de arredondamento (centavos) para totais fiscais do rodapé. */
function approxDocMoneyEqual(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 0.05;
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
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Valida totais do documento vs soma das linhas (DANFE: produtos ≠ total da nota por frete/impostos no rodapé).
 * @returns {string[]} avisos informativos (não bloqueiam lançamento)
 */
export function buildDocumentTotalHints(parsed, lineTotals = []) {
  const warnings = [];
  const productsSubtotal = parseBrDecimal(parsed?.productsSubtotal);
  const documentTotal = parseBrDecimal(parsed?.documentTotal);
  const freight = parseBrDecimal(parsed?.freightAmount) ?? 0;
  const insurance = parseBrDecimal(parsed?.insuranceAmount) ?? 0;
  const otherExpenses = parseBrDecimal(parsed?.otherExpensesAmount) ?? 0;
  const discount = parseBrDecimal(parsed?.discountAmount) ?? 0;
  const icmsSt = parseBrDecimal(parsed?.icmsStAmount) ?? 0;

  const lines = (lineTotals || []).filter((n) => Number.isFinite(n) && n > 0);
  if (!lines.length) return warnings;

  const linesSum = roundMoney(lines.reduce((s, n) => s + n, 0));
  const accessories = roundMoney(freight + insurance + otherExpenses + icmsSt - discount);
  const expectedDoc = roundMoney(linesSum + accessories);
  const expectedFromProducts =
    productsSubtotal != null ? roundMoney(productsSubtotal + accessories) : null;

  if (productsSubtotal != null && !approxDocMoneyEqual(linesSum, productsSubtotal)) {
    if (approxDocMoneyEqual(linesSum, documentTotal) && accessories > 0.01) {
      warnings.push(
        "A soma dos itens coincide com o total da nota, mas há despesas no rodapé. Confira se os V. TOTAL das linhas estão corretos (não use BC ICMS)."
      );
    }
  }

  if (documentTotal == null) return warnings;

  if (approxDocMoneyEqual(documentTotal, linesSum)) return warnings;

  if (
    approxDocMoneyEqual(documentTotal, expectedDoc) ||
    (expectedFromProducts != null && approxDocMoneyEqual(documentTotal, expectedFromProducts))
  ) {
    const parts = [];
    if (otherExpenses > 0) parts.push(`outras despesas R$ ${otherExpenses.toFixed(2)}`);
    if (icmsSt > 0) parts.push(`ICMS ST R$ ${icmsSt.toFixed(2)}`);
    if (freight > 0) parts.push(`frete R$ ${freight.toFixed(2)}`);
    if (insurance > 0) parts.push(`seguro R$ ${insurance.toFixed(2)}`);
    if (discount > 0) parts.push(`desconto R$ ${discount.toFixed(2)}`);
    const extra = roundMoney(documentTotal - linesSum);
    const detail = parts.length ? ` (${parts.join(", ")})` : "";
    warnings.push(
      `Total da nota R$ ${documentTotal.toFixed(2)} é R$ ${extra.toFixed(2)} acima da soma dos produtos R$ ${linesSum.toFixed(2)}${detail}. O lançamento usa só os itens da tabela; o valor final da NF pode incluir taxas do rodapé.`
    );
    return warnings;
  }

  if (documentTotal > linesSum + 0.02 && !approxDocMoneyEqual(documentTotal, expectedDoc)) {
    warnings.push(
      `Total da nota (R$ ${documentTotal.toFixed(2)}) difere da soma dos produtos (R$ ${linesSum.toFixed(2)}). Revise se preços vieram da coluna V. TOTAL e não de impostos (BC ICMS / V. ICMS).`
    );
  }

  return warnings;
}

function normalizeLineTypeHint(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "venda") return "venda";
  if (s === "insumo") return "insumo";
  return null;
}

export function normalizeRawAiItem(it, allowedUnits = []) {
  const reconciled = reconcileLineItem({
    quantity: it?.quantity,
    unitPrice: it?.unitPrice,
    lineTotal: it?.lineTotal
  });

  const catalogProductName = String(it?.catalogProductName || "").trim() || null;
  const productName = String(it?.productName || "").trim() || null;

  return {
    productName,
    productNameNormalized:
      String(it?.productNameNormalized || catalogProductName || productName || "").trim() || null,
    catalogProductName,
    categoryHint: String(it?.categoryHint || "").trim() || null,
    lineTypeHint: normalizeLineTypeHint(it?.lineTypeHint),
    quantity: reconciled.quantity,
    unitPrice: reconciled.unitPrice,
    lineTotal: reconciled.lineTotal,
    unitUsed: it?.unitUsed ? normalizeReceiptUnit(it.unitUsed, allowedUnits) : null,
    notes: it?.notes ? String(it.notes).trim() : null,
    reconcileWarnings: reconciled.warnings
  };
}

/** Compara unidade da nota com unidade padrão do catálogo (após normalização). */
export function receiptUnitConflict(noteUnit, catalogUnit, allowedUnits = []) {
  if (!noteUnit || !catalogUnit) return null;
  const a = normalizeReceiptUnit(noteUnit, allowedUnits);
  const b = normalizeUnitUsed(catalogUnit, allowedUnits);
  if (unitCode(a) === unitCode(b)) return null;
  return { noteUnit: a, catalogUnit: b };
}
