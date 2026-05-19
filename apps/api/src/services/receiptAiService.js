import { config } from "../config.js";
import { getActiveMeasurementUnits, normalizeUnitUsed } from "../lib/measurementUnits.js";
import { normalizeProductNameKey } from "../lib/productNameNormalize.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { quickResolveOrCreateProduct } from "./productQuickCreateService.js";
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

/** Segundo modelo se o principal esgotar tentativas (ex.: Gemini com “Provider returned error” em algumas PNG). */
function openRouterFallbackModel() {
  if (process.env.OPENROUTER_FALLBACK_MODEL === "") return null;
  const v = (process.env.OPENROUTER_FALLBACK_MODEL ?? "openai/gpt-4o-mini").trim();
  if (!v || /^(off|false|none|0)$/i.test(v)) return null;
  if (v === config.openRouterModel) return null;
  return v;
}

async function callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject, pdfPlugin, model }) {
  // Mídia antes do texto: melhora compatibilidade com modelos de visão no OpenRouter.
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

  const items = rawItems.map((it) => {
    const rawLabel = String(it?.productName || "").trim();
    const normalizedLabel = String(it?.productNameNormalized || it?.productName || "").trim();
    const matchKey = normalizeProductNameKey(normalizedLabel);

    const resolved = resolveOneProductLabel(rawLabel || normalizedLabel, products, resolveCtx);
    const best = resolved.product;
    const matchScore = resolved.score;
    itemMatchMeta.push({
      matchKind: resolved.matchKind,
      score: matchScore,
      rawLabel: rawLabel || normalizedLabel,
      matchKey
    });

    let qty = it?.quantity == null ? null : Number(it.quantity);
    const unitPrice = it?.unitPrice == null ? null : Number(it.unitPrice);
    if ((!Number.isFinite(qty) || qty <= 0) && singleLine && Number.isFinite(unitPrice) && unitPrice > 0) {
      qty = 1;
    }
    let unitUsed = "un";
    if (best?.standard_unit) {
      unitUsed = normalizeUnitUsed(best.standard_unit, allowedUnits);
    } else if (it?.unitUsed) {
      unitUsed = normalizeUnitUsed(it.unitUsed, allowedUnits);
    }
    const missing = [];
    if (!best || matchScore < MIN_PRODUCT_FUZZY) missing.push("produto");
    if (!Number.isFinite(qty) || qty <= 0) missing.push("quantidade");
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) missing.push("valor unitário");
    return {
      rawProductName: it?.productName || null,
      productId: best?.id || null,
      productName: best?.name || null,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
      unitUsed,
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
      lineType: best?.type === "venda" ? "venda" : "insumo",
      missing,
      suggestedProductMatches: resolved.suggestedProductMatches,
      matchKindResolved: resolved.matchKind,
      matchScoreResolved: matchScore
    };
  });

  const invRaw = parsed?.invoiceNumber;
  const invoiceNormalized =
    invRaw == null || String(invRaw).trim() === "" ? null : String(invRaw).replace(/\s+/g, " ").trim();

  const missingGlobal = [];
  if (!invoiceNormalized) missingGlobal.push("número da nota");
  if (!parsed?.purchaseDate) missingGlobal.push("data da compra");
  if (!supplierMatch.best || supplierMatch.score < MIN_SUPPLIER_MATCH) missingGlobal.push("fornecedor");

  return {
    invoiceNumber: invoiceNormalized,
    purchaseDate: parsed?.purchaseDate || null,
    supplierSuggestion: supplierMatch.best
      ? { id: supplierMatch.best.id, name: supplierMatch.best.name, confidence: supplierMatch.score }
      : null,
    items,
    missingGlobal,
    _itemMatchMeta: itemMatchMeta
  };
}

/**
 * Garante productId em cada linha com rótulo + preço válidos (criação automática em "Outros" se necessário).
 */
async function finalizeReceiptItemsWithAutoProducts(mapped, { supplierIdHint, userId, matchCtx }) {
  const items = mapped?.items || [];
  for (let i = 0; i < items.length; i += 1) {
    const row = items[i];
    if (row.productId) continue;
    const label = String(row.rawProductName || "").trim();
    const unitPrice = row.unitPrice;
    if (!label || unitPrice == null || !Number.isFinite(Number(unitPrice)) || Number(unitPrice) <= 0) continue;
    try {
      const { product, reused, resolvedVia } = await quickResolveOrCreateProduct({
        displayName: label,
        lineType: row.lineType === "venda" ? "venda" : "insumo",
        supplierId: supplierIdHint || null,
        createdBy: "ai_auto",
        userIdForAudit: userId || null,
        needsCatalogReview: true,
        resolveCtx: matchCtx
      });
      row.productId = product.id;
      row.productName = product.name;
      row.lineType = product.type === "venda" ? "venda" : "insumo";
      row.autoCreated = Boolean(!reused && resolvedVia === "created");
      row.resolvedVia = resolvedVia;
      row.missing = (row.missing || []).filter((m) => m !== "produto");
    } catch {
      /* mantém missing produto */
    }
  }
  return mapped;
}

export async function parseReceiptWithAI({
  imageBuffer,
  mimeType,
  products = [],
  suppliers = [],
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
  const productNames = truncateCatalogNames((products || []).map((p) => p.name).filter(Boolean), 150, 220);
  const supplierNames = truncateCatalogNames((suppliers || []).map((s) => s.name).filter(Boolean), 120, 140);
  let allowedUnits = [];
  try {
    allowedUnits = await getActiveMeasurementUnits(supabaseAdmin);
  } catch {
    allowedUnits = [];
  }

  const prompt = [
    "Extraia dados desta nota fiscal brasileira e retorne SOMENTE JSON válido.",
    "Em NFS-e (serviço), supplierName deve ser o EMITENTE / PRESTADOR do serviço (quem emitiu a nota), não o tomador.",
    "purchaseDate: use a data de emissão ou competência impressa na nota; converta DD/MM/AAAA para YYYY-MM-DD copiando o ANO exatamente como impresso (confunda 3 com 6: 2026 ≠ 2023).",
    "Em cupons e notas brasileiras o formato de data costuma ser DIA/MÊS/ANO (DD/MM/AAAA): o primeiro grupo é o dia, o segundo é o mês (ex.: 10/11/2018 → 2018-11-10, não outubro).",
    "Campos do JSON:",
    "{",
    '  "invoiceNumber": "string|null",',
    '  "purchaseDate": "YYYY-MM-DD|null",',
    '  "supplierName": "string|null",',
    '  "items": [',
    "    {",
    '      "productName": "string",',
    '      "productNameNormalized": "string|null",',
    '      "quantity": number|null,',
    '      "unitUsed": "unidade da nota (ex.: kg, un, cx, L, saco, fardo) ou null",',
    '      "unitPrice": number|null',
    "    }",
    "  ]",
    "}",
    "Não invente valores.",
    "Se não achar algum campo, use null.",
    "Itens — productName: use o texto literal da nota quando não houver correspondência clara com o catálogo.",
    "Itens — productNameNormalized: opcional; se preencher, deve ser uma forma limpa do nome (sem acentos desnecessários, espaços únicos) para casar com produtos cadastrados; pode repetir productName se já estiver limpo.",
    "Se um item da nota for claramente o mesmo produto que um nome da lista de produtos cadastrados, copie EXATAMENTE esse nome da lista em productName (e o mesmo em productNameNormalized).",
    "Em nota de serviço com um único valor, pode haver um item com productName = descrição do serviço e unitPrice = valor do serviço; quantity pode ser null ou 1.",
    `Produtos cadastrados (reutilize um destes nomes quando for o mesmo produto): ${JSON.stringify(productNames)}`,
    `Fornecedores cadastrados: ${JSON.stringify(supplierNames)}`,
    `Unidades cadastradas na rede (prefira uma destas em unitUsed): ${JSON.stringify(allowedUnits)}`
  ].join("\n");

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
      await finalizeReceiptItemsWithAutoProducts(mapped, {
        supplierIdHint: supplierIdForLearn,
        userId,
        matchCtx
      });

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
        model
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
