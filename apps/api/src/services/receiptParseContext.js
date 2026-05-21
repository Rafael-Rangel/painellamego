import { getActiveMeasurementUnits } from "../lib/measurementUnits.js";
import { buildReceiptCatalogContext } from "../lib/receiptCatalogContext.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { buildReceiptAiPrompt } from "./receiptAiPrompt.js";
import {
  loadGlobalCanonicalAliasMap,
  preloadSupplierMatchContext
} from "./productMatchService.js";

function truncateSupplierNames(suppliers, max = 120) {
  return (suppliers || [])
    .map((s) => String(s.name || "").trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Contexto partilhado por pedido POST /receipt-ai-parse (uma vez por request).
 */
export async function buildReceiptParseContext({
  products = [],
  suppliers = [],
  categories = [],
  supplierIdHint = null
}) {
  const started = Date.now();
  const supplierId =
    supplierIdHint && /^[0-9a-f-]{36}$/i.test(String(supplierIdHint)) ? String(supplierIdHint) : null;

  const [allowedUnits, globalAliasByKey, supplierCtx] = await Promise.all([
    getActiveMeasurementUnits(supabaseAdmin).catch(() => []),
    loadGlobalCanonicalAliasMap(supabaseAdmin).catch(() => new Map()),
    supplierId
      ? preloadSupplierMatchContext(supabaseAdmin, supplierId, products).catch(() => null)
      : Promise.resolve(null)
  ]);

  const supplierBoostIds =
    supplierCtx?.candidateProducts?.length > 0
      ? new Set(supplierCtx.candidateProducts.map((p) => p.id))
      : null;

  const catalogOpts = { maxProducts: 150 };
  if (supplierCtx?.candidateProducts?.length) {
    catalogOpts.supplierProductIds = new Set(supplierCtx.candidateProducts.map((p) => p.id));
    catalogOpts.maxProducts = 100;
    catalogOpts.maxSupplierProducts = 65;
  }

  const { catalogProducts, categoryNames } = buildReceiptCatalogContext(products, categories, catalogOpts);
  const prompt = buildReceiptAiPrompt({
    catalogProducts,
    categoryNames,
    supplierNames: truncateSupplierNames(suppliers),
    allowedUnits
  });

  const matchCtx = {
    aliasByKey: supplierCtx?.aliasByKey instanceof Map ? supplierCtx.aliasByKey : new Map(),
    candidateProducts: supplierCtx?.candidateProducts?.length ? supplierCtx.candidateProducts : products,
    globalAliasByKey,
    receiptUseFullCatalog: true,
    supplierBoostIds
  };

  return {
    prompt,
    allowedUnits,
    matchCtx,
    supplierIdForLearn: supplierId,
    catalogLines: catalogProducts.length,
    buildMs: Date.now() - started
  };
}
