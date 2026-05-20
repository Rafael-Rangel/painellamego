export const DEFAULT_MEASUREMENT_UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct", "fardo", "saco", "maço", "bdj"];

export function unitCode(name = "") {
  return String(name).trim().toLowerCase();
}

export function normalizeUnitName(name = "") {
  const trimmed = String(name).trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "l") return "L";
  return trimmed;
}

export function mergeUnitList(catalogUnits = [], extra = []) {
  const byCode = new Map();
  for (const raw of [...DEFAULT_MEASUREMENT_UNITS, ...catalogUnits, ...extra]) {
    const name = normalizeUnitName(raw);
    if (!name) continue;
    byCode.set(unitCode(name), name);
  }
  return [...byCode.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function normalizeUnitUsed(value, allowedUnits = []) {
  const allowed = mergeUnitList(allowedUnits);
  const raw = String(value || "").trim();
  if (!raw) return allowed.includes("un") ? "un" : allowed[0] || "un";
  const lower = raw.toLowerCase();
  const match = allowed.find((u) => String(u).toLowerCase() === lower);
  if (match) return match;
  if (raw.length <= 24 && /^[\p{L}\p{N}%./_-]+$/u.test(raw)) return raw;
  return allowed.includes("un") ? "un" : allowed[0] || "un";
}

export async function getActiveMeasurementUnits(supabase) {
  const { data, error } = await supabase
    .from("measurement_units")
    .select("name")
    .eq("is_active", true)
    .order("name");
  if (!error && data?.length) {
    return data.map((row) => normalizeUnitName(row.name)).filter(Boolean);
  }

  const { data: products } = await supabase.from("products").select("standard_unit").eq("is_active", true);
  const fromProducts = (products || []).map((p) => p.standard_unit).filter(Boolean);
  return mergeUnitList([], fromProducts);
}

export async function ensureMeasurementUnitExists(supabase, unitName) {
  const name = normalizeUnitName(unitName);
  if (!name) return;
  const code = unitCode(name);
  const { error } = await supabase.from("measurement_units").upsert(
    { code, name, is_active: true },
    { onConflict: "code" }
  );
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("relation") && msg.includes("measurement_units")) return;
    throw error;
  }
}
