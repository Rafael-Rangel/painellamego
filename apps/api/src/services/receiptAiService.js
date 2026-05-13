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

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openRouterModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` }
            }
          ]
        }
      ]
    })
  });

  const payload = await resp.json();
  if (!resp.ok) {
    throw new Error(payload?.error?.message || "Falha ao chamar OpenRouter.");
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
