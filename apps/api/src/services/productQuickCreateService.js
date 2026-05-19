import { normalizeProductNameKey, QUICK_PRODUCT_CATEGORY } from "../lib/productNameNormalize.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { logAudit } from "./auditService.js";
import {
  AUTO_ALIAS_MIN_SCORE,
  MIN_PRODUCT_FUZZY,
  loadGlobalCanonicalAliasMap,
  maybeRecordAutoAlias,
  maybeRecordPendingAlias,
  preloadSupplierMatchContext,
  resolveOneProductLabel,
  touchSupplierAlias
} from "./productMatchService.js";

function toCategoryCode(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function ensureCategoryExists(categoryName) {
  const name = String(categoryName || "").trim();
  if (!name) return;
  const code = toCategoryCode(name) || `cat-${Date.now()}`;
  const { error } = await supabaseAdmin.from("categories").upsert(
    { code, name, is_active: true },
    { onConflict: "code" }
  );
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("relation") && msg.includes("categories")) return;
    throw error;
  }
}

/**
 * Cria produto mínimo em "Outros" ou devolve existente (dedupe).
 * @param {object} opts
 * @param {string} opts.displayName
 * @param {'insumo'|'venda'} [opts.lineType]
 * @param {string} [opts.category] — categoria do catálogo; padrão "Outros"
 * @param {string|null} [opts.supplierId]
 * @param {'admin'|'manager'|'ai_auto'} opts.createdBy
 * @param {string|null} [opts.userIdForAudit]
 * @param {boolean} [opts.needsCatalogReview]
 * @param {object|null} [opts.resolveCtx] — contexto já montado (ex.: parse NF); senão monta com catálogo completo.
 */
export async function quickResolveOrCreateProduct(opts) {
  const displayName = String(opts.displayName || "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2) {
    throw new Error("Nome do produto inválido.");
  }
  const keyStrong = normalizeProductNameKey(displayName);
  const keyLegacy = displayName.toLowerCase();
  const lineType = opts.lineType ?? "insumo";
  const categoryName =
    String(opts.category || QUICK_PRODUCT_CATEGORY).trim() || QUICK_PRODUCT_CATEGORY;
  const supplierIdQuick = opts.supplierId || null;
  const createdBy = opts.createdBy;
  const needsCatalogReview = Boolean(opts.needsCatalogReview);
  const userIdForAudit = opts.userIdForAudit || null;

  const { data: allProducts, error: pAllErr } = await supabaseAdmin.from("products").select("*").eq("is_active", true);
  if (pAllErr) throw new Error(pAllErr.message);
  const products = allProducts || [];

  const globalAliasByKey =
    opts.resolveCtx?.globalAliasByKey instanceof Map && opts.resolveCtx.globalAliasByKey.size > 0
      ? opts.resolveCtx.globalAliasByKey
      : await loadGlobalCanonicalAliasMap(supabaseAdmin);

  let ctx = opts.resolveCtx;
  if (!ctx) {
    if (supplierIdQuick) {
      const sup = await preloadSupplierMatchContext(supabaseAdmin, supplierIdQuick, products);
      const supplierBoostIds = new Set((sup.candidateProducts || []).map((p) => p.id));
      ctx = { ...sup, globalAliasByKey, receiptUseFullCatalog: true, supplierBoostIds };
    } else {
      ctx = { aliasByKey: new Map(), candidateProducts: products, globalAliasByKey, receiptUseFullCatalog: true, supplierBoostIds: null };
    }
  } else {
    ctx = {
      ...ctx,
      globalAliasByKey,
      receiptUseFullCatalog: ctx.receiptUseFullCatalog ?? true,
      supplierBoostIds: ctx.supplierBoostIds ?? null
    };
  }

  const resMatch = resolveOneProductLabel(displayName, products, ctx);
  if (resMatch.product) {
    if (supplierIdQuick) {
      if (resMatch.matchKind === "alias") {
        await touchSupplierAlias(supabaseAdmin, supplierIdQuick, keyStrong).catch(() => {});
      } else if (resMatch.matchKind === "fuzzy") {
        const sc = Number(resMatch.score || 0);
        if (sc >= AUTO_ALIAS_MIN_SCORE) {
          await maybeRecordAutoAlias(supabaseAdmin, {
            supplierId: supplierIdQuick,
            rawLabel: displayName,
            productId: resMatch.product.id,
            score: sc
          }).catch(() => {});
        } else if (sc >= MIN_PRODUCT_FUZZY) {
          await maybeRecordPendingAlias(supabaseAdmin, {
            supplierId: supplierIdQuick,
            rawLabel: displayName,
            productId: resMatch.product.id,
            score: sc
          }).catch(() => {});
        }
      } else if (["global_alias", "exact", "aggressive"].includes(resMatch.matchKind)) {
        await maybeRecordAutoAlias(supabaseAdmin, {
          supplierId: supplierIdQuick,
          rawLabel: displayName,
          productId: resMatch.product.id,
          score: 0.95
        }).catch(() => {});
      }
    }
    return { product: resMatch.product, reused: true, resolvedVia: resMatch.matchKind };
  }

  const { data: byStrong, error: e1 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", categoryName)
    .eq("normalized_name", keyStrong)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (byStrong && byStrong.is_active !== false) return { product: byStrong, reused: true, resolvedVia: "db_exact" };

  const { data: byLegacy, error: e2 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", categoryName)
    .eq("normalized_name", keyLegacy)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  if (byLegacy && byLegacy.is_active !== false) return { product: byLegacy, reused: true, resolvedVia: "db_legacy" };

  const { data: outrosRows, error: e3 } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("category", categoryName)
    .limit(3000);
  if (e3) throw new Error(e3.message);
  const sameKey = (outrosRows || []).find((p) => p.is_active !== false && normalizeProductNameKey(p.name) === keyStrong);
  if (sameKey) return { product: sameKey, reused: true, resolvedVia: "db_scan" };

  await ensureCategoryExists(categoryName);
  const catCode = toCategoryCode(categoryName);
  const { data: catRow } = await supabaseAdmin.from("categories").select("id").eq("code", catCode).maybeSingle();

  const insertPayload = {
    name: displayName,
    normalized_name: keyStrong,
    category: categoryName,
    type: lineType,
    standard_unit: "un",
    is_active: true,
    created_by: createdBy,
    needs_catalog_review: needsCatalogReview
  };
  if (catRow?.id) insertPayload.category_id = catRow.id;

  const { data: created, error: insErr } = await supabaseAdmin.from("products").insert(insertPayload).select("*").single();
  if (insErr) {
    const msg = String(insErr.message || "");
    if (msg.toLowerCase().includes("unique") || insErr.code === "23505") {
      const { data: again } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("category", categoryName)
        .eq("normalized_name", keyStrong)
        .maybeSingle();
      if (again) return { product: again, reused: true, resolvedVia: "race_dedupe" };
    }
    throw new Error(insErr.message);
  }

  if (userIdForAudit) {
    await logAudit({
      userId: userIdForAudit,
      action: "create",
      resource: "product_quick",
      payload: { productId: created.id, createdBy }
    });
  }

  return { product: created, reused: false, resolvedVia: "created" };
}
