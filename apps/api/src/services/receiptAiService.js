import { config } from "../config.js";

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

/** Limiares de fuzzy match cadastro ↔ texto da nota (descrições longas em NFS-e). */
const MIN_PRODUCT_MATCH = 0.5;
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

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(body)
  });

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

function mapAiParsedToReceiptOutput(parsed, products, suppliers) {
  const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
  const rawItems = parsed?.items || [];
  const singleLine = rawItems.length === 1;

  const items = rawItems.map((it) => {
    const productMatch = bestMatchByName(it?.productName, products, "name");
    let qty = it?.quantity == null ? null : Number(it.quantity);
    const unitPrice = it?.unitPrice == null ? null : Number(it.unitPrice);
    if ((!Number.isFinite(qty) || qty <= 0) && singleLine && Number.isFinite(unitPrice) && unitPrice > 0) {
      qty = 1;
    }
    const unitRaw = String(it?.unitUsed || "").toLowerCase();
    const unitUsed = ["kg", "un", "cx", "l", "g", "ml"].includes(unitRaw) ? (unitRaw === "l" ? "L" : unitRaw) : "un";
    const missing = [];
    if (!productMatch.best || productMatch.score < MIN_PRODUCT_MATCH) missing.push("produto");
    if (!Number.isFinite(qty) || qty <= 0) missing.push("quantidade");
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) missing.push("valor unitário");
    return {
      rawProductName: it?.productName || null,
      productId: productMatch.best?.id || null,
      productName: productMatch.best?.name || null,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
      unitUsed,
      unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null,
      lineType: productMatch.best?.type === "venda" ? "venda" : "insumo",
      missing
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
    missingGlobal
  };
}

export async function parseReceiptWithAI({
  imageBuffer,
  mimeType,
  products = [],
  suppliers = []
}) {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada.");
  }

  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const productNames = truncateCatalogNames((products || []).map((p) => p.name).filter(Boolean), 150, 220);
  const supplierNames = truncateCatalogNames((suppliers || []).map((s) => s.name).filter(Boolean), 120, 140);

  const prompt = [
    "Extraia dados desta nota fiscal brasileira e retorne SOMENTE JSON válido.",
    "Em NFS-e (serviço), supplierName deve ser o EMITENTE / PRESTADOR do serviço (quem emitiu a nota), não o tomador.",
    "purchaseDate: use a data de emissão ou competência impressa na nota; converta DD/MM/AAAA para YYYY-MM-DD copiando o ANO exatamente como impresso (confunda 3 com 6: 2026 ≠ 2023).",
    "Campos do JSON:",
    "{",
    '  "invoiceNumber": "string|null",',
    '  "purchaseDate": "YYYY-MM-DD|null",',
    '  "supplierName": "string|null",',
    '  "items": [',
    "    {",
    '      "productName": "string",',
    '      "quantity": number|null,',
    '      "unitUsed": "kg|un|cx|L|g|ml|outro|null",',
    '      "unitPrice": number|null',
    "    }",
    "  ]",
    "}",
    "Não invente valores.",
    "Se não achar algum campo, use null.",
    "Em nota de serviço com um único valor, pode haver um item com productName = descrição do serviço e unitPrice = valor do serviço; quantity pode ser null ou 1.",
    `Produtos cadastrados: ${JSON.stringify(productNames)}`,
    `Fornecedores cadastrados: ${JSON.stringify(supplierNames)}`
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
      return mapAiParsedToReceiptOutput(parsed, products, suppliers);
    } catch (e) {
      errors.push(String(e?.message || e));
    }
  }

  throw new Error(`OpenRouter: ${errors.join(" || ")}`);
}
