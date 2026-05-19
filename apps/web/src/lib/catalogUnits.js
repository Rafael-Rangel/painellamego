export const DEFAULT_MEASUREMENT_UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct", "fardo"];

export function normalizeUnitName(name = "") {
  const trimmed = String(name).trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "l") return "L";
  return trimmed;
}

/** Lista única e ordenada para selects (API + produtos + valor atual). */
export function buildUnitOptions(catalogUnits = [], products = [], currentValue = "") {
  const fromProducts = (products || []).map((p) => p.standard_unit).filter(Boolean);
  const byCode = new Map();
  for (const raw of [...DEFAULT_MEASUREMENT_UNITS, ...catalogUnits, ...fromProducts, currentValue]) {
    const name = normalizeUnitName(raw);
    if (!name) continue;
    byCode.set(name.toLowerCase(), name);
  }
  return [...byCode.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function normalizeUnitUsed(value, allowedUnits = []) {
  const allowed = buildUnitOptions(allowedUnits);
  const raw = String(value || "").trim();
  if (!raw) return allowed.includes("un") ? "un" : allowed[0] || "un";
  const lower = raw.toLowerCase();
  const match = allowed.find((u) => String(u).toLowerCase() === lower);
  if (match) return match;
  if (raw.length <= 24) return raw;
  return allowed.includes("un") ? "un" : allowed[0] || "un";
}
