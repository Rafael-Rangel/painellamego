/** Helpers de confiança dos campos sugeridos pela IA. */

export function needsReview(confidence) {
  return confidence === "medium" || confidence === "low";
}

export function confidenceClass(key, confidenceMap, highlightKeys) {
  const conf = confidenceMap?.[key];
  if (needsReview(conf)) return "field-ai-review";
  if (highlightKeys?.has?.(key)) return "field-ai-suggested";
  return "";
}

export function confidenceLabel(confidence) {
  if (needsReview(confidence)) return "Revisar";
  return null;
}

export const EMPTY_DOCUMENT_METADATA = {
  accessKey: "",
  series: "",
  issueDate: "",
  exitDate: "",
  orderNumber: "",
  paymentTerms: "",
  paymentDeadlineDays: "",
  salesRep: "",
  carrierName: "",
  complementaryInfo: ""
};

const METADATA_LABELS = {
  accessKey: "Chave de acesso",
  series: "Série",
  issueDate: "Data de emissão",
  exitDate: "Data de saída",
  orderNumber: "Pedido",
  paymentTerms: "Condição de pagamento",
  paymentDeadlineDays: "Prazo (dias)",
  salesRep: "Representante",
  carrierName: "Transportadora",
  complementaryInfo: "Informações complementares"
};

export function metadataToNotesText(metadata = {}, invoiceNotesExtra = "") {
  const lines = [];
  for (const [key, label] of Object.entries(METADATA_LABELS)) {
    const val = metadata[key];
    if (val == null || val === "") continue;
    lines.push(`${label}: ${val}`);
  }
  const extra = String(invoiceNotesExtra || "").trim();
  if (extra) {
    if (lines.length) lines.push("");
    lines.push(extra);
  }
  return lines.join("\n").trim();
}

export function mapApiMetadataToForm(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    accessKey: src.accessKey || "",
    series: src.series || "",
    issueDate: src.issueDate || "",
    exitDate: src.exitDate || "",
    orderNumber: src.orderNumber || "",
    paymentTerms: src.paymentTerms || "",
    paymentDeadlineDays:
      src.paymentDeadlineDays != null && src.paymentDeadlineDays !== "" ? String(src.paymentDeadlineDays) : "",
    salesRep: src.salesRep || "",
    carrierName: src.carrierName || "",
    complementaryInfo: src.complementaryInfo || ""
  };
}

export function mapApiAdjustmentLines(lines = []) {
  return (lines || []).map((row) => ({
    name: String(row?.name || ""),
    amount: row?.amount != null ? String(row.amount) : "",
    aiConfidence: row?.confidence || null
  }));
}

export function mapApiInstallments(lines = []) {
  return (lines || []).map((row) => ({
    dueDate: row?.dueDate || "",
    amount: row?.amount != null ? String(row.amount) : "",
    notes: row?.notes || "",
    aiConfidence: row?.confidence || null
  }));
}

/** Converte metadados do formulário para JSON persistido. */
export function serializeDocumentMetadata(metadata = {}) {
  const out = {};
  for (const [key, val] of Object.entries(metadata || {})) {
    if (val == null || val === "") continue;
    if (key === "paymentDeadlineDays") {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) out[key] = Math.round(n);
      continue;
    }
    const s = String(val).trim();
    if (s) out[key] = s;
  }
  return out;
}
