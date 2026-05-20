import { config } from "../config.js";
import { getActiveMeasurementUnits, normalizeUnitUsed } from "../lib/measurementUnits.js";
import { normalizeProductNameKey } from "../lib/productNameNormalize.js";
import { buildReceiptCatalogContext } from "../lib/receiptCatalogContext.js";
import {
  buildDocumentTotalHints,
  normalizeRawAiItem,
  receiptUnitConflict
} from "../lib/receiptParseUtils.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { buildReceiptAiPrompt } from "./receiptAiPrompt.js";
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

function stripCodeFences(text = "") {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/** Tenta obter um objeto JSON da resposta em texto livre (markdown, texto extra, etc.). */
function parseJsonFromModelContent(content) {
  const raw = String(content ?? "").trim();
  if (!raw) throw new Error("A IA retornou resposta vazia.");
  const stripped = stripCodeFences(raw);
  try {
    return JSON.parse(stripped);
  } catch {
    /* ignore */
  }
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = stripped.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      /* ignore */
    }
  }
  throw new Error("A IA retornou resposta em formato inválido.");
}

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

/** Conteúdo multimodal conforme OpenRouter: imagens via image_url; PDF via type file + file_data (data URL). */
function visionPartsForMime(mimeType, dataUrl) {
  if (mimeType === "application/pdf") {
    return [
      {
        type: "file",
        file: {
          filename: "nota-fiscal.pdf",
          file_data: dataUrl
        }
      }
    ];
  }
  return [
    {
      type: "image_url",
      image_url: { url: dataUrl }
    }
  ];
}

function truncateCatalogNames(names, maxItems = 120, maxCharsPerName = 100) {
  return (names || [])
    .map((n) => String(n || "").trim().slice(0, maxCharsPerName))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Limiar de fuzzy match fornecedor na nota (supplierName). */
const MIN_SUPPLIER_MATCH = 0.55;

function openRouterHeaders() {
  const h = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    "Content-Type": "application/json"
  };
  if (config.openRouterHttpReferer) {
    h["HTTP-Referer"] = config.openRouterHttpReferer;
  }
  if (config.openRouterAppTitle) {
    h["X-Title"] = config.openRouterAppTitle;
  }
  return h;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(
        `Tempo esgotado (${Math.round(timeoutMs / 1000)}s) ao contactar a IA. Tente foto menor, menos páginas no PDF ou outra rede.`
      );
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Segundo modelo se o principal esgotar tentativas. */
function openRouterFallbackModel() {
  if (process.env.OPENROUTER_FALLBACK_MODEL === "") return null;
  const v = (process.env.OPENROUTER_FALLBACK_MODEL ?? "google/gemini-2.5-flash").trim();
  if (!v || /^(off|false|none|0)$/i.test(v)) return null;
  if (v === config.openRouterModel) return null;
  return v;
}

async function callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject, pdfPlugin, model }) {
  const userContent = [...visionPartsForMime(mimeType, dataUrl), { type: "text", text: prompt }];

  const body = {
    model: model || config.openRouterModel,
    temperature: 0.1,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: userContent
      }
    ]
  };

  if (useJsonObject) {
    body.response_format = { type: "json_object" };
  }

  const usePdfPlugin = pdfPlugin !== false && mimeType === "application/pdf";
  if (usePdfPlugin) {
    body.plugins = [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }];
  }

  const resp = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(body)
    },
    config.openRouterFetchTimeoutMs
  );

  const payload = await resp.json();
  if (!resp.ok) {
    const msg = payload?.error?.message || JSON.stringify(payload?.error || payload);
    const err = new Error(msg);
    err.status = resp.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

async function fetchOpenRouterPayloadWithRetries({ prompt, dataUrl, mimeType, model }) {
  let payload;
  try {
    payload = await callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject: true, model });
  } catch (firstErr) {
    try {
      payload = await callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject: false, model });
    } catch (secondErr) {
      if (mimeType === "application/pdf") {
        try {
          payload = await callOpenRouterChat({
            prompt,
            dataUrl,
            mimeType,
            useJsonObject: false,
            pdfPlugin: false,
            model
          });
        } catch (thirdErr) {
          const hint = [firstErr, secondErr, thirdErr]
            .map((e) => String(e?.message || e))
            .filter(Boolean)
            .join(" | ");
          throw new Error(`[${model || config.openRouterModel}] ${hint}`);
        }
      } else {
        const hint = [firstErr, secondErr]
          .map((e) => String(e?.message || e))
          .filter(Boolean)
          .join(" | ");
        throw new Error(`[${model || config.openRouterModel}] ${hint}`);
      }
    }
  }
  return payload;
}

function mapAiParsedToReceiptOutput(parsed, products, suppliers, matchCtx, allowedUnits = []) {
  const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
  const rawItems = parsed?.items || [];
  const singleLine = rawItems.length === 1;

  const aliasByKey = matchCtx?.aliasByKey instanceof Map ? matchCtx.aliasByKey : new Map();
  const candidateProducts = matchCtx?.candidateProducts?.length ? matchCtx.candidateProducts : products;
  const resolveCtx = {
    aliasByKey,
    candidateProducts,
    globalAliasByKey: matchCtx?.globalAliasByKey instanceof Map ? matchCtx.globalAliasByKey : new Map(),
    receiptUseFullCatalog: Boolean(matchCtx?.receiptUseFullCatalog),
    supplierBoostIds: matchCtx?.supplierBoostIds instanceof Set ? matchCtx.supplierBoostIds : null
  };

  const itemMatchMeta = [];
  const reconcileWarnings = [];

  const items = rawItems.map((rawIt, idx) => {
    const norm = normalizeRawAiItem(rawIt, allowedUnits);
    for (const w of norm.reconcileWarnings || []) {
      const label = norm.productName || `linha ${idx + 1}`;
      reconcileWarnings.push(`${label}: ${w}`);
    }

    const rawLabel = norm.productName || "";
    const normalizedLabel = norm.productNameNormalized || rawLabel;
    const labelForMatch = norm.catalogProductName || rawLabel || normalizedLabel;
    const matchKey = normalizeProductNameKey(normalizedLabel);

    const resolved = resolveOneProductLabel(labelForMatch || normalizedLabel, products, resolveCtx);
    const best = resolved.product;
    const matchScore = resolved.score;
    itemMatchMeta.push({
      matchKind: resolved.matchKind,
      score: matchScore,
      rawLabel: rawLabel || normalizedLabel,
      matchKey
    });

    let qty = norm.quantity;
    const unitPrice = norm.unitPrice;
    if ((!Number.isFinite(qty) || qty <= 0) && singleLine && Number.isFinite(unitPrice) && unitPrice > 0) {
      qty = 1;
    }
    const noteUnit = norm.unitUsed;
    let unitUsed = "un";
    if (best?.standard_unit) {
      unitUsed = normalizeUnitUsed(best.standard_unit, allowedUnits);
    } else if (noteUnit) {
      unitUsed = noteUnit;
    }

    const unitClash = best?.standard_unit ? receiptUnitConflict(noteUnit, best.standard_unit, allowedUnits) : null;
    if (unitClash) {
      reconcileWarnings.push(
        `${norm.productName || `linha ${idx + 1}`}: unidade na nota (${unitClash.noteUnit}) difere do catálogo (${unitClash.catalogUnit}) — confira quantidade e unidade`
      );
    }

    const category =
      String(best?.category || norm.categoryHint || "").trim() || null;
    const lineType = best?.type === "venda" ? "venda" : norm.lineTypeHint === "venda" ? "venda" : "insumo";

    const missing = [];
    if (!best || matchScore < MIN_PRODUCT_FUZZY) missing.push("produto");
    if (!category) missing.push("categoria");
    if (!Number.isFinite(qty) || qty <= 0) missing.push("quantidade");
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) missing.push("valor unitário");
    return {
      rawProductName: norm.productName,
      productId: best?.id || null,
      productName: best?.name || null,
      category,
      categoryHint: norm.categoryHint || null,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
      unitUsed,
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
      lineTotal: norm.lineTotal,
      lineType,
      missing,
      suggestedProductMatches: resolved.suggestedProductMatches,
      matchKindResolved: resolved.matchKind,
      matchScoreResolved: matchScore
    };
  });

  const invRaw = parsed?.invoiceNumber;
  const invoiceNormalized =
    invRaw == null || String(invRaw).trim() === "" ? null : String(invRaw).replace(/\s+/g, " ").trim();

  const docHints = buildDocumentTotalHints(parsed, items.map((it) => it.lineTotal));
  const missingGlobal = [...new Set([...reconcileWarnings, ...docHints])];
  if (!invoiceNormalized) missingGlobal.push("número da nota");
  if (!parsed?.purchaseDate) missingGlobal.push("data da compra");
  if (!supplierMatch.best || supplierMatch.score < MIN_SUPPLIER_MATCH) missingGlobal.push("fornecedor");

  return {
    documentType: parsed?.documentType || null,
    invoiceNumber: invoiceNormalized,
    purchaseDate: parsed?.purchaseDate || null,
    supplierName: parsed?.supplierName ? String(parsed.supplierName).trim() : null,
    supplierSuggestion: supplierMatch.best
      ? { id: supplierMatch.best.id, name: supplierMatch.best.name, confidence: supplierMatch.score }
      : null,
    items,
    missingGlobal,
    documentTotals:
      parsed?.documentTotal != null || parsed?.productsSubtotal != null
        ? {
            productsSubtotal: parsed?.productsSubtotal ?? null,
            documentTotal: parsed?.documentTotal ?? null,
            freightAmount: parsed?.freightAmount ?? null,
            insuranceAmount: parsed?.insuranceAmount ?? null,
            otherExpensesAmount: parsed?.otherExpensesAmount ?? null,
            discountAmount: parsed?.discountAmount ?? null,
            icmsStAmount: parsed?.icmsStAmount ?? null
          }
        : null,
    _itemMatchMeta: itemMatchMeta
  };
}

/** Mantém linhas sem produto no catálogo para o gerente escolher categoria antes de confirmar. */
async function finalizeReceiptItemsWithAutoProducts(mapped) {
  return mapped;
}

export async function parseReceiptWithAI({
  imageBuffer,
  mimeType,
  products = [],
  suppliers = [],
  categories = [],
  supplierIdHint = null,
  userId = null
}) {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }

  const parseStarted = Date.now();
  const inputBytes = imageBuffer?.length ?? 0;
  console.info("[receipt-ai] parse início", { mimeType, inputBytes, userId: userId || null });

  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const supplierNames = truncateCatalogNames((suppliers || []).map((s) => s.name).filter(Boolean), 120, 140);
  const { catalogProducts, categoryNames } = buildReceiptCatalogContext(products, categories);
  let allowedUnits = [];
  try {
    allowedUnits = await getActiveMeasurementUnits(supabaseAdmin);
  } catch {
    allowedUnits = [];
  }

  const prompt = buildReceiptAiPrompt({
    catalogProducts,
    categoryNames,
    supplierNames,
    allowedUnits
  });

  const models = [config.openRouterModel];
  const fb = openRouterFallbackModel();
  if (fb) models.push(fb);

  const errors = [];
  for (const model of models) {
    try {
      const payload = await fetchOpenRouterPayloadWithRetries({ prompt, dataUrl, mimeType, model });
      const content = payload?.choices?.[0]?.message?.content || "{}";
      const parsed = parseJsonFromModelContent(content);

      const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
      const supplierIdForLearn = supplierIdHint || supplierMatch.best?.id || null;

      let globalAliasByKey = new Map();
      try {
        globalAliasByKey = await loadGlobalCanonicalAliasMap(supabaseAdmin);
      } catch {
        globalAliasByKey = new Map();
      }

      let matchCtx = {
        aliasByKey: new Map(),
        candidateProducts: products,
        globalAliasByKey,
        receiptUseFullCatalog: true,
        supplierBoostIds: null
      };
      if (supplierIdForLearn) {
        try {
          const sup = await preloadSupplierMatchContext(supabaseAdmin, supplierIdForLearn, products);
          const supplierBoostIds = new Set((sup.candidateProducts || []).map((p) => p.id));
          matchCtx = { ...sup, globalAliasByKey, receiptUseFullCatalog: true, supplierBoostIds };
        } catch {
          matchCtx = {
            aliasByKey: new Map(),
            candidateProducts: products,
            globalAliasByKey,
            receiptUseFullCatalog: true,
            supplierBoostIds: null
          };
        }
      }

      const mapped = mapAiParsedToReceiptOutput(parsed, products, suppliers, matchCtx, allowedUnits);
      await finalizeReceiptItemsWithAutoProducts(mapped);

      if (supplierIdForLearn && mapped._itemMatchMeta?.length) {
        const tasks = [];
        for (let i = 0; i < mapped._itemMatchMeta.length; i += 1) {
          const m = mapped._itemMatchMeta[i];
          const row = mapped.items[i];
          if (!row?.productId) continue;
          const rawLabel = m.rawLabel || row.rawProductName;
          if (!rawLabel) continue;
          if (m.matchKind === "alias" && m.matchKey) {
            tasks.push(touchSupplierAlias(supabaseAdmin, supplierIdForLearn, m.matchKey).catch(() => {}));
          } else if (m.matchKind === "fuzzy") {
            if (m.score >= AUTO_ALIAS_MIN_SCORE) {
              tasks.push(
                maybeRecordAutoAlias(supabaseAdmin, {
                  supplierId: supplierIdForLearn,
                  rawLabel,
                  productId: row.productId,
                  score: m.score
                }).catch(() => {})
              );
            } else if (m.score >= MIN_PRODUCT_FUZZY) {
              tasks.push(
                maybeRecordPendingAlias(supabaseAdmin, {
                  supplierId: supplierIdForLearn,
                  rawLabel,
                  productId: row.productId,
                  score: m.score
                }).catch(() => {})
              );
            }
          } else if (["global_alias", "exact", "aggressive"].includes(m.matchKind)) {
            tasks.push(
              maybeRecordAutoAlias(supabaseAdmin, {
                supplierId: supplierIdForLearn,
                rawLabel,
                productId: row.productId,
                score: 0.95
              }).catch(() => {})
            );
          }
        }
        for (let i = 0; i < mapped.items.length; i += 1) {
          const row = mapped.items[i];
          if (!row?.autoCreated || !supplierIdForLearn || !row.productId || !row.rawProductName) continue;
          tasks.push(
            maybeRecordAutoAlias(supabaseAdmin, {
              supplierId: supplierIdForLearn,
              rawLabel: row.rawProductName,
              productId: row.productId,
              score: 0.9
            }).catch(() => {})
          );
        }
        await Promise.all(tasks);
      }
      delete mapped._itemMatchMeta;
      console.info("[receipt-ai] parse ok", {
        mimeType,
        inputBytes,
        ms: Date.now() - parseStarted,
        items: mapped.items?.length ?? 0,
        model,
        documentType: mapped.documentType
      });
      return mapped;
    } catch (e) {
      errors.push(String(e?.message || e));
    }
  }

  console.error("[receipt-ai] parse falhou", {
    mimeType,
    inputBytes,
    ms: Date.now() - parseStarted,
    errors
  });
  throw new Error(`OpenRouter: ${errors.join(" || ")}`);
}
