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

/** Várias páginas/imagens devem ser tratadas como UM documento único. */
function visionPartsForDocuments(documents = []) {
  const parts = [];
  for (let i = 0; i < documents.length; i += 1) {
    const doc = documents[i];
    const pageLabel = `Página ${i + 1}/${documents.length}`;
    parts.push({ type: "text", text: pageLabel });
    parts.push(...visionPartsForMime(doc.mimeType, doc.dataUrl));
  }
  return parts;
}

function truncateCatalogNames(names, maxItems = 120, maxCharsPerName = 100) {
  return (names || [])
    .map((n) => String(n || "").trim().slice(0, maxCharsPerName))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Limiar de fuzzy match fornecedor na nota (supplierName). */
const MIN_SUPPLIER_MATCH = 0.55;

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

function openAiHeaders() {
  return {
    Authorization: `Bearer ${config.openaiApiKey}`,
    "Content-Type": "application/json"
  };
}

/** OpenAI: detail auto preserva mais detalhe em imagens (GPT-5.5). */
function visionPartsForOpenAi(mimeType, dataUrl) {
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
      image_url: { url: dataUrl, detail: "auto" }
    }
  ];
}

function visionPartsForOpenAiDocuments(documents = []) {
  const parts = [];
  for (let i = 0; i < documents.length; i += 1) {
    const doc = documents[i];
    parts.push({ type: "text", text: `Página ${i + 1}/${documents.length}` });
    parts.push(...visionPartsForOpenAi(doc.mimeType, doc.dataUrl));
  }
  return parts;
}

function openRouterFallbackModel() {
  if (process.env.OPENROUTER_FALLBACK_MODEL === "") return null;
  const v = String(config.openRouterFallbackModel || "").trim();
  if (!v || /^(off|false|none|0)$/i.test(v)) return null;
  return v;
}

function buildUserMessageContent({ prompt, dataUrl, mimeType, documents, provider }) {
  const docParts =
    Array.isArray(documents) && documents.length
      ? provider === "openai"
        ? visionPartsForOpenAiDocuments(documents)
        : visionPartsForDocuments(documents)
      : provider === "openai"
        ? visionPartsForOpenAi(mimeType, dataUrl)
        : visionPartsForMime(mimeType, dataUrl);
  return [...docParts, { type: "text", text: prompt }];
}

async function callChatCompletions({
  provider,
  prompt,
  dataUrl,
  mimeType,
  documents,
  useJsonObject,
  pdfPlugin,
  model
}) {
  const isOpenAi = provider === "openai";
  const url = isOpenAi
    ? "https://api.openai.com/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const headers = isOpenAi ? openAiHeaders() : openRouterHeaders();
  const timeoutMs = isOpenAi ? config.openaiFetchTimeoutMs : config.openRouterFetchTimeoutMs;
  const maxTokens = isOpenAi ? config.openaiMaxTokens : config.openRouterMaxTokens;
  const selectedModel =
    model || (isOpenAi ? config.openaiModel : config.openRouterFallbackModel);

  const body = {
    model: selectedModel,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: buildUserMessageContent({ prompt, dataUrl, mimeType, documents, provider })
      }
    ]
  };

  // GPT-5.x na OpenAI Platform usa max_completion_tokens (não max_tokens).
  if (isOpenAi) {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
  }

  if (useJsonObject) {
    body.response_format = { type: "json_object" };
  }

  if (!isOpenAi) {
    const hasPdf =
      mimeType === "application/pdf" ||
      (Array.isArray(documents) && documents.some((d) => d?.mimeType === "application/pdf"));
    const usePdfPlugin = pdfPlugin !== false && hasPdf;
    if (usePdfPlugin) {
      body.plugins = [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }];
    }
  }

  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    },
    timeoutMs
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

async function fetchChatPayloadWithRetries({ provider, prompt, dataUrl, mimeType, documents, model }) {
  const label = model || (provider === "openai" ? config.openaiModel : config.openRouterFallbackModel);
  let payload;
  try {
    payload = await callChatCompletions({
      provider,
      prompt,
      dataUrl,
      mimeType,
      documents,
      useJsonObject: true,
      model
    });
  } catch (firstErr) {
    try {
      payload = await callChatCompletions({
        provider,
        prompt,
        dataUrl,
        mimeType,
        documents,
        useJsonObject: false,
        model
      });
    } catch (secondErr) {
      const hasPdf =
        mimeType === "application/pdf" ||
        (Array.isArray(documents) && documents.some((d) => d?.mimeType === "application/pdf"));
      if (provider === "openrouter" && hasPdf) {
        try {
          payload = await callChatCompletions({
            provider,
            prompt,
            dataUrl,
            mimeType,
            documents,
            useJsonObject: false,
            pdfPlugin: false,
            model
          });
        } catch (thirdErr) {
          const hint = [firstErr, secondErr, thirdErr]
            .map((e) => String(e?.message || e))
            .filter(Boolean)
            .join(" | ");
          throw new Error(`[${label}] ${hint}`);
        }
      } else {
        const hint = [firstErr, secondErr]
          .map((e) => String(e?.message || e))
          .filter(Boolean)
          .join(" | ");
        throw new Error(`[${label}] ${hint}`);
      }
    }
  }
  return payload;
}

function extractMessageContent(payload) {
  return payload?.choices?.[0]?.message?.content || "{}";
}

function dedupeRawItems(rawItems = []) {
  const seen = new Set();
  const out = [];
  for (const it of rawItems || []) {
    const key = [
      normalizeText(it?.catalogProductName || it?.productNameNormalized || it?.productName || ""),
      Number(it?.quantity ?? 0) || 0,
      Number(it?.unitPrice ?? 0) || 0,
      Number(it?.lineTotal ?? 0) || 0,
      normalizeText(it?.unitUsed || "")
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function mapAiParsedToReceiptOutput(parsed, products, suppliers, matchCtx, allowedUnits = []) {
  const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
  const rawItems = dedupeRawItems(parsed?.items || []);
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
        `${norm.productName || `linha ${idx + 1}`}: unidade na nota (${unitClash.noteUnit}) difere do catálogo (${unitClash.catalogUnit}). Confira quantidade e unidade.`
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

/** Tarefas de aprendizado de alias (executar após responder ao cliente). */
export function collectReceiptAliasLearningTasks(mapped, supplierIdForLearn) {
  const tasks = [];
  if (!supplierIdForLearn || !mapped?._itemMatchMeta?.length) return tasks;

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
  return tasks;
}

export async function parseReceiptWithAI({
  imageBuffer,
  mimeType,
  documents = null,
  products = [],
  suppliers = [],
  categories = [],
  supplierIdHint = null,
  userId = null,
  sharedParseCtx = null,
  deferAliasLearning = false
}) {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const parseStarted = Date.now();
  const inputBytes = imageBuffer?.length ?? 0;
  console.info("[receipt-ai] parse início", { mimeType, inputBytes, userId: userId || null });

  let dataUrl = null;
  let docParts = null;
  if (Array.isArray(documents) && documents.length) {
    docParts = documents.map((d) => {
      const b64 = d.buffer.toString("base64");
      return {
        mimeType: d.mimeType,
        dataUrl: `data:${d.mimeType};base64,${b64}`
      };
    });
  } else {
    const base64 = imageBuffer.toString("base64");
    dataUrl = `data:${mimeType};base64,${base64}`;
  }

  let prompt;
  let allowedUnits;
  let matchCtx;
  let supplierIdForLearn;
  let dbPrepMs = 0;

  if (sharedParseCtx?.prompt) {
    prompt = sharedParseCtx.prompt;
    allowedUnits = sharedParseCtx.allowedUnits || [];
    matchCtx = sharedParseCtx.matchCtx;
    supplierIdForLearn = sharedParseCtx.supplierIdForLearn ?? null;
  } else {
    const prepStarted = Date.now();
    const supplierNames = truncateCatalogNames((suppliers || []).map((s) => s.name).filter(Boolean), 120, 140);
    const { catalogProducts, categoryNames } = buildReceiptCatalogContext(products, categories);
    try {
      allowedUnits = await getActiveMeasurementUnits(supabaseAdmin);
    } catch {
      allowedUnits = [];
    }
    prompt = buildReceiptAiPrompt({
      catalogProducts,
      categoryNames,
      supplierNames,
      allowedUnits
    });
    let globalAliasByKey = new Map();
    try {
      globalAliasByKey = await loadGlobalCanonicalAliasMap(supabaseAdmin);
    } catch {
      globalAliasByKey = new Map();
    }
    const hint = supplierIdHint && /^[0-9a-f-]{36}$/i.test(String(supplierIdHint)) ? supplierIdHint : null;
    supplierIdForLearn = hint;
    matchCtx = {
      aliasByKey: new Map(),
      candidateProducts: products,
      globalAliasByKey,
      receiptUseFullCatalog: true,
      supplierBoostIds: null
    };
    if (hint) {
      try {
        const sup = await preloadSupplierMatchContext(supabaseAdmin, hint, products);
        const supplierBoostIds = new Set((sup.candidateProducts || []).map((p) => p.id));
        matchCtx = { ...sup, globalAliasByKey, receiptUseFullCatalog: true, supplierBoostIds };
      } catch {
        /* mantém matchCtx base */
      }
    }
    dbPrepMs = Date.now() - prepStarted;
  }

  const attempts = [{ provider: "openai", model: config.openaiModel }];
  const fb = openRouterFallbackModel();
  if (fb && config.openRouterApiKey) {
    attempts.push({ provider: "openrouter", model: fb });
  }

  const errors = [];
  for (const { provider, model } of attempts) {
    try {
      const aiStarted = Date.now();
      const payload = await fetchChatPayloadWithRetries({
        provider,
        prompt,
        dataUrl,
        mimeType,
        documents: docParts,
        model
      });
      const aiMs = Date.now() - aiStarted;
      const content = extractMessageContent(payload);
      const parsed = parseJsonFromModelContent(content);

      const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
      const learnId = supplierIdForLearn || supplierIdHint || supplierMatch.best?.id || null;

      const matchStarted = Date.now();
      const mapped = mapAiParsedToReceiptOutput(parsed, products, suppliers, matchCtx, allowedUnits);
      const matchMs = Date.now() - matchStarted;
      await finalizeReceiptItemsWithAutoProducts(mapped);

      const aliasTasks = collectReceiptAliasLearningTasks(mapped, learnId);
      if (!deferAliasLearning && aliasTasks.length) {
        const aliasStarted = Date.now();
        await Promise.all(aliasTasks);
        console.info("[receipt-ai] aliasMs", { ms: Date.now() - aliasStarted, count: aliasTasks.length });
      }

      delete mapped._itemMatchMeta;
      const result = { ...mapped, _deferredAliasTasks: deferAliasLearning ? aliasTasks : [] };
      console.info("[receipt-ai] parse ok", {
        mimeType,
        inputBytes,
        ms: Date.now() - parseStarted,
        dbPrepMs,
        aiMs,
        matchMs,
        items: mapped.items?.length ?? 0,
        provider,
        model,
        documentType: mapped.documentType,
        aliasDeferred: deferAliasLearning ? aliasTasks.length : 0
      });
      return result;
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
  throw new Error(`IA (OpenAI/OpenRouter): ${errors.join(" || ")}`);
}
