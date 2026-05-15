import { normalizeProductNameKey, normalizeProductNameKeyAggressive } from "../lib/productNameNormalize.js";
import { recalculateProductSnapshot } from "./comparisonService.js";

/**
 * Funde produtos duplicados no canónico: atualiza referências, grava aliases globais, desativa absorvidos.
 */
export async function mergeProductsIntoCanonical(client, opts) {
  const canonicalId = String(opts.canonicalProductId || "").trim();
  const mergeIds = [...new Set((opts.mergeProductIds || []).map((id) => String(id).trim()).filter(Boolean))].filter((id) => id !== canonicalId);
  if (!canonicalId || !mergeIds.length) {
    return { ok: false, error: "canonicalProductId e mergeProductIds são obrigatórios." };
  }

  const { data: canonical, error: cErr } = await client.from("products").select("*").eq("id", canonicalId).maybeSingle();
  if (cErr || !canonical?.id) return { ok: false, error: cErr?.message || "Produto canónico não encontrado." };

  const { data: mergeRows, error: mErr } = await client.from("products").select("id,name,normalized_name").in("id", mergeIds);
  if (mErr) return { ok: false, error: mErr.message };
  if (!mergeRows?.length) return { ok: false, error: "Nenhum produto a fundir encontrado." };

  const { error: piErr } = await client.from("purchase_items").update({ product_id: canonicalId }).in("product_id", mergeIds);
  if (piErr) return { ok: false, error: piErr.message };

  const { error: alErr } = await client.from("alerts").update({ product_id: canonicalId }).in("product_id", mergeIds);
  if (alErr && !String(alErr.message || "").toLowerCase().includes("column")) {
    return { ok: false, error: alErr.message };
  }

  const { error: spaErr } = await client
    .from("supplier_product_aliases")
    .update({ product_id: canonicalId, updated_at: new Date().toISOString() })
    .in("product_id", mergeIds);
  if (spaErr) return { ok: false, error: spaErr.message };

  await client.from("price_snapshots").delete().in("product_id", mergeIds);

  const aliasByKey = new Map();
  const canonNorm = normalizeProductNameKey(canonical.name);
  const canonAgg = normalizeProductNameKeyAggressive(canonical.name);
  for (const p of mergeRows) {
    const keys = new Set();
    const k1 = normalizeProductNameKey(p.name);
    const k2 = normalizeProductNameKeyAggressive(p.name);
    const k3 = p.normalized_name ? normalizeProductNameKey(String(p.normalized_name)) : "";
    if (k1 && k1 !== canonNorm) keys.add(k1);
    if (k2 && k2 !== canonAgg) keys.add(k2);
    if (k3 && k3 !== canonNorm) keys.add(k3);
    for (const normalized_key of keys) {
      if (!aliasByKey.has(normalized_key)) {
        aliasByKey.set(normalized_key, {
          canonical_product_id: canonicalId,
          normalized_key,
          label_raw: p.name,
          source: "merge"
        });
      }
    }
  }
  for (const row of aliasByKey.values()) {
    const { error: insA } = await client.from("product_canonical_aliases").upsert(row, { onConflict: "normalized_key" });
    if (insA) {
      const msg = String(insA.message || "").toLowerCase();
      if (!msg.includes("duplicate") && !msg.includes("unique")) return { ok: false, error: insA.message };
    }
  }

  const updateCanonical = {};
  if (opts.newName && String(opts.newName).trim().length >= 2) {
    updateCanonical.name = String(opts.newName).trim().replace(/\s+/g, " ");
    updateCanonical.normalized_name = normalizeProductNameKey(updateCanonical.name);
  }
  if (opts.newCategory && String(opts.newCategory).trim().length >= 2) {
    updateCanonical.category = String(opts.newCategory).trim();
  }
  if (Object.keys(updateCanonical).length) {
    const { error: uErr } = await client.from("products").update(updateCanonical).eq("id", canonicalId);
    if (uErr) return { ok: false, error: uErr.message };
  }

  const { error: deactErr } = await client
    .from("products")
    .update({ is_active: false, needs_catalog_review: false })
    .in("id", mergeIds);
  if (deactErr) return { ok: false, error: deactErr.message };

  try {
    await recalculateProductSnapshot(canonicalId);
  } catch {
    /* sem linhas ainda */
  }

  return { ok: true, mergedCount: mergeIds.length };
}
