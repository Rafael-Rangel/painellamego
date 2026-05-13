import { normalizeProductNameKey } from "../lib/productNameNormalize.js";

/** Igual ao receiptAiService: fuzzy leve entre strings. */
function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function similarityScore(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const aTokens = new Set(na.split(/\s+/).filter(Boolean));
  const bTokens = new Set(nb.split(/\s+/).filter(Boolean));
  const inter = [...aTokens].filter((t) => bTokens.has(t)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return inter / union;
}

function productDbNormalizedKey(p) {
  const raw = p?.normalized_name != null && String(p.normalized_name).trim() !== "" ? String(p.normalized_name).trim() : null;
  if (raw) return normalizeProductNameKey(raw);
  return normalizeProductNameKey(p?.name);
}

function findProductExactNormalized(products, key) {
  if (!key) return null;
  for (const p of products || []) {
    if (productDbNormalizedKey(p) === key) return p;
  }
  return null;
}

function bestMatchByName(name, list, labelKey = "name") {
  if (name == null || String(name).trim() === "") return { best: null, score: 0 };
  let best = null;
  let bestScore = 0;
  for (const item of list || []) {
    const score = similarityScore(name, item?.[labelKey]);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return { best, score: bestScore };
}

function topSuggestedProductMatches(name, products, limit = 3, minScore = 0.12) {
  const label = String(name || "").trim();
  if (!label) return [];
  const scored = (products || [])
    .map((p) => ({ p, score: similarityScore(label, p?.name) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ p, score }) => ({
    id: p.id,
    name: p.name,
    confidence: score
  }));
}

export const MIN_PRODUCT_FUZZY = 0.5;
/** Acima disto grava alias automático (fornecedor + rótulo) quando há supplier_id. */
export const AUTO_ALIAS_MIN_SCORE = 0.88;

const FREQUENT_PRODUCTS_LIMIT = 200;
const CATALOG_FALLBACK_LIMIT = 400;

/**
 * Carrega aliases do fornecedor e lista de produtos candidatos (histórico de compras com esse fornecedor).
 */
export async function preloadSupplierMatchContext(supabaseAdmin, supplierId, allProducts) {
  const products = allProducts || [];
  if (!supplierId) {
    return {
      aliasByKey: new Map(),
      candidateProducts: products.slice(0, CATALOG_FALLBACK_LIMIT)
    };
  }

  const { data: aliasRows, error: aErr } = await supabaseAdmin
    .from("supplier_product_aliases")
    .select("id,label_normalized,label_raw,product_id,source,confidence,products(*)")
    .eq("supplier_id", supplierId);
  if (aErr) throw new Error(aErr.message);

  const aliasByKey = new Map();
  for (const row of aliasRows || []) {
    const key = String(row.label_normalized || "").trim();
    const prod = row.products;
    if (key && prod?.id) aliasByKey.set(key, prod);
  }

  const { data: freqRows, error: fErr } = await supabaseAdmin
    .from("purchase_items")
    .select("product_id")
    .eq("supplier_id", supplierId);
  if (fErr) throw new Error(fErr.message);

  const counts = new Map();
  for (const r of freqRows || []) {
    const pid = r.product_id;
    if (!pid) continue;
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FREQUENT_PRODUCTS_LIMIT)
    .map(([id]) => id);

  const byId = new Map(products.map((p) => [p.id, p]));
  const candidateProducts = [];
  const seen = new Set();
  for (const id of topIds) {
    const p = byId.get(id);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      candidateProducts.push(p);
    }
  }
  if (candidateProducts.length < 20) {
    for (const p of products) {
      if (candidateProducts.length >= CATALOG_FALLBACK_LIMIT) break;
      if (!seen.has(p.id)) {
        seen.add(p.id);
        candidateProducts.push(p);
      }
    }
  }

  return { aliasByKey, candidateProducts: candidateProducts.length ? candidateProducts : products.slice(0, CATALOG_FALLBACK_LIMIT) };
}

/**
 * Resolve um rótulo livre para um produto do catálogo (alias → exact global → fuzzy no conjunto candidato).
 * @returns {{ product: object|null, matchKind: 'alias'|'exact'|'fuzzy'|'none', score: number, suggestedProductMatches: array }}
 */
export function resolveOneProductLabel(rawLabel, allProducts, ctx) {
  const { aliasByKey = new Map(), candidateProducts = allProducts } = ctx || {};
  const raw = String(rawLabel || "").trim();
  const normalizedLabel = raw;
  const matchKey = normalizeProductNameKey(normalizedLabel);

  const aliasHit = matchKey ? aliasByKey.get(matchKey) : null;
  if (aliasHit?.id) {
    return {
      product: aliasHit,
      matchKind: "alias",
      score: 1,
      suggestedProductMatches: topSuggestedProductMatches(raw, allProducts, 3, 0.12)
    };
  }

  const exact = findProductExactNormalized(allProducts, matchKey);
  if (exact) {
    return {
      product: exact,
      matchKind: "exact",
      score: 1,
      suggestedProductMatches: topSuggestedProductMatches(raw, allProducts, 3, 0.12)
    };
  }

  const fuzzy = bestMatchByName(raw || normalizedLabel, candidateProducts, "name");
  const best = fuzzy.score >= MIN_PRODUCT_FUZZY ? fuzzy.best : null;
  const matchScore = fuzzy.score;
  return {
    product: best,
    matchKind: best ? "fuzzy" : "none",
    score: matchScore,
    suggestedProductMatches: topSuggestedProductMatches(raw || normalizedLabel, candidateProducts, 3, 0.12)
  };
}

/**
 * Incrementa use_count / last_seen ao acertar um alias existente.
 */
export async function touchSupplierAlias(supabaseAdmin, supplierId, labelNormalized) {
  if (!supplierId || !labelNormalized) return;
  const { data: row } = await supabaseAdmin
    .from("supplier_product_aliases")
    .select("id,use_count")
    .eq("supplier_id", supplierId)
    .eq("label_normalized", labelNormalized)
    .maybeSingle();
  if (!row?.id) return;
  await supabaseAdmin
    .from("supplier_product_aliases")
    .update({
      use_count: Number(row.use_count || 0) + 1,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id);
}

/**
 * Upsert alias (admin ou aprendizagem automática).
 */
export async function upsertSupplierProductAlias(supabaseAdmin, { supplierId, labelNormalized, labelRaw, productId, source, confidence }) {
  const key = String(labelNormalized || "").trim();
  if (!supplierId || !key || !productId) return { ok: false, error: "missing_fields" };
  const payload = {
    supplier_id: supplierId,
    label_normalized: key,
    label_raw: labelRaw != null ? String(labelRaw).slice(0, 500) : null,
    product_id: productId,
    source: source || "admin",
    confidence: confidence != null ? Number(confidence) : null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabaseAdmin
    .from("supplier_product_aliases")
    .upsert(payload, { onConflict: "supplier_id,label_normalized" })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function deleteSupplierProductAlias(supabaseAdmin, id) {
  const { error } = await supabaseAdmin.from("supplier_product_aliases").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Grava alias automático quando fuzzy ≥ AUTO_ALIAS_MIN_SCORE.
 */
export async function maybeRecordAutoAlias(supabaseAdmin, { supplierId, rawLabel, productId, score }) {
  if (!supplierId || !productId || !rawLabel) return;
  if (score < AUTO_ALIAS_MIN_SCORE) return;
  const labelNormalized = normalizeProductNameKey(rawLabel);
  if (!labelNormalized) return;
  await upsertSupplierProductAlias(supabaseAdmin, {
    supplierId,
    labelNormalized,
    labelRaw: rawLabel,
    productId,
    source: "auto_high",
    confidence: score
  });
}

/** Sugestão para revisão admin: match fuzzy médio (não sobrescreve admin/auto_high). */
export async function maybeRecordPendingAlias(supabaseAdmin, { supplierId, rawLabel, productId, score }) {
  if (!supplierId || !productId || !rawLabel) return;
  if (score >= AUTO_ALIAS_MIN_SCORE || score < MIN_PRODUCT_FUZZY) return;
  const labelNormalized = normalizeProductNameKey(rawLabel);
  if (!labelNormalized) return;
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("supplier_product_aliases")
    .select("id,source")
    .eq("supplier_id", supplierId)
    .eq("label_normalized", labelNormalized)
    .maybeSingle();
  if (exErr) return;
  const src = String(existing?.source || "");
  if (src === "admin" || src === "auto_high" || src === "manager") return;
  await upsertSupplierProductAlias(supabaseAdmin, {
    supplierId,
    labelNormalized,
    labelRaw: rawLabel,
    productId,
    source: "auto_pending",
    confidence: score
  });
}
