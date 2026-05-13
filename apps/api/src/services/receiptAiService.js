import { config } from "../config.js";

function stripCodeFences(text = "") {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
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

async function callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject }) {
  const userContent = [{ type: "text", text: prompt }, ...visionPartsForMime(mimeType, dataUrl)];

  const body = {
    model: config.openRouterModel,
    temperature: 0.1,
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

  if (mimeType === "application/pdf") {
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
  const productNames = (products || []).map((p) => p.name).filter(Boolean).slice(0, 500);
  const supplierNames = (suppliers || []).map((s) => s.name).filter(Boolean).slice(0, 500);

  const prompt = [
    "Extraia dados desta nota fiscal brasileira e retorne SOMENTE JSON válido.",
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
    `Produtos cadastrados: ${JSON.stringify(productNames)}`,
    `Fornecedores cadastrados: ${JSON.stringify(supplierNames)}`
  ].join("\n");

  let payload;
  try {
    payload = await callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject: true });
  } catch (firstErr) {
    const m = String(firstErr?.message || "").toLowerCase();
    const retry =
      m.includes("response_format") ||
      m.includes("json_object") ||
      m.includes("structured") ||
      firstErr?.status === 400;
    if (retry) {
      payload = await callOpenRouterChat({ prompt, dataUrl, mimeType, useJsonObject: false });
    } else {
      throw firstErr;
    }
  }

  const content = payload?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences(content));
  } catch {
    throw new Error("A IA retornou resposta em formato inválido.");
  }

  const supplierMatch = bestMatchByName(parsed?.supplierName, suppliers, "name");
  const items = (parsed?.items || []).map((it) => {
    const productMatch = bestMatchByName(it?.productName, products, "name");
    const qty = it?.quantity == null ? null : Number(it.quantity);
    const unitPrice = it?.unitPrice == null ? null : Number(it.unitPrice);
    const unitRaw = String(it?.unitUsed || "").toLowerCase();
    const unitUsed = ["kg", "un", "cx", "l", "g", "ml"].includes(unitRaw) ? (unitRaw === "l" ? "L" : unitRaw) : "un";
    const missing = [];
    if (!productMatch.best || productMatch.score < 0.6) missing.push("produto");
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

  const missingGlobal = [];
  if (!parsed?.invoiceNumber) missingGlobal.push("número da nota");
  if (!parsed?.purchaseDate) missingGlobal.push("data da compra");
  if (!supplierMatch.best || supplierMatch.score < 0.6) missingGlobal.push("fornecedor");

  return {
    invoiceNumber: parsed?.invoiceNumber || null,
    purchaseDate: parsed?.purchaseDate || null,
    supplierSuggestion: supplierMatch.best
      ? { id: supplierMatch.best.id, name: supplierMatch.best.name, confidence: supplierMatch.score }
      : null,
    items,
    missingGlobal
  };
}
