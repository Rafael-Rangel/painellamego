import test from "node:test";
import assert from "node:assert/strict";
import {
  RECEIPT_AI_OPENAI_MODEL,
  RECEIPT_AI_OPENROUTER_FALLBACK_MODEL
} from "../src/receiptAiModels.js";

function isOpenAiUrl(url) {
  return String(url || "").includes("api.openai.com");
}

function isOpenRouterUrl(url) {
  return String(url || "").includes("openrouter.ai");
}

function isAiChatUrl(url) {
  return isOpenAiUrl(url) || isOpenRouterUrl(url);
}

/** @supabase/postgrest-js usa `res.text()` + JSON.parse, não `json()`. */
function fakePostgrestEmptyArray() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    async text() {
      return "[]";
    }
  };
}

const okReceiptJson = {
  invoiceNumber: "123",
  purchaseDate: "2026-05-01",
  supplierName: "Fornecedor X",
  items: [
    {
      productName: "Produto Y",
      quantity: 2,
      unitUsed: "kg",
      unitPrice: 10.5
    }
  ]
};

test("parseReceiptWithAI: PDF no OpenAI falha e OpenRouter usa file + plugin", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    calls.push({ url, body: JSON.parse(init.body) });
    if (isOpenAiUrl(url)) {
      return {
        ok: false,
        status: 400,
        async json() {
          return { error: { message: "PDF not supported on OpenAI test" } };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: JSON.stringify(okReceiptJson) } }]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const pdfBuf = Buffer.from("%PDF-1.4 fake", "utf8");
  const out = await parseReceiptWithAI({
    imageBuffer: pdfBuf,
    mimeType: "application/pdf",
    products: [{ id: "p1", name: "Produto Y", type: "insumo" }],
    suppliers: [{ id: "s1", name: "Fornecedor X" }]
  });

  assert.ok(calls.some((c) => isOpenRouterUrl(c.url)));
  const orCall = calls.find((c) => isOpenRouterUrl(c.url));
  assert.ok(orCall);
  const content = orCall.body.messages[0].content;
  assert.equal(content[0].type, "file");
  assert.ok(Array.isArray(orCall.body.plugins));
  assert.equal(out.invoiceNumber, "123");

  delete global.fetch;
});

test("parseReceiptWithAI: JPEG usa OpenRouter primeiro (fallback OpenAI se OR falhar)", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    calls.push({ url, body: JSON.parse(init.body) });
    if (isOpenRouterUrl(url)) {
      return {
        ok: false,
        status: 502,
        async json() {
          return { error: { message: "OpenRouter down" } };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  invoiceNumber: null,
                  purchaseDate: null,
                  supplierName: null,
                  items: []
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [],
    suppliers: []
  });

  assert.ok(calls.some((c) => isOpenRouterUrl(c.url)));
  const oaCall = calls.find((c) => isOpenAiUrl(c.url));
  assert.ok(oaCall);
  assert.equal(oaCall.body.model, RECEIPT_AI_OPENAI_MODEL);
  const content = oaCall.body.messages[0].content;
  const img = content.find((c) => c.type === "image_url");
  assert.ok(img);
  assert.equal(img.image_url.detail, "auto");
  assert.ok(!oaCall.body.plugins);

  delete global.fetch;
});

test("parseReceiptWithAI: falha OpenAI na 1ª chamada faz retry sem response_format", async () => {
  let n = 0;
  global.fetch = async (url, init) => {
    if (!isOpenAiUrl(url)) return fakePostgrestEmptyArray();
    n += 1;
    const body = JSON.parse(init.body);
    if (n === 1) {
      assert.ok(body.response_format?.type === "json_object");
      return {
        ok: false,
        status: 502,
        async json() {
          return { error: { message: "Provider returned error" } };
        }
      };
    }
    assert.ok(!body.response_format, "2ª tentativa não deve forçar json_object");
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content:
                  "```json\n" +
                  JSON.stringify({
                    invoiceNumber: "999",
                    purchaseDate: "2026-01-15",
                    supplierName: "Fornecedor X",
                    items: [
                      {
                        productName: "Produto Y",
                        quantity: 1,
                        unitUsed: "un",
                        unitPrice: 5
                      }
                    ]
                  }) +
                  "\n```"
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [{ id: "p1", name: "Produto Y", type: "insumo" }],
    suppliers: [{ id: "s1", name: "Fornecedor X" }]
  });

  assert.equal(n, 2);
  assert.equal(out.invoiceNumber, "999");

  delete global.fetch;
});

test("parseReceiptWithAI: esgota OpenRouter e usa fallback OpenAI", async () => {
  let n = 0;
  global.fetch = async (url, init) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    n += 1;
    const body = JSON.parse(init.body);
    if (isOpenRouterUrl(url)) {
      return {
        ok: false,
        status: 502,
        async json() {
          return { error: { message: "OpenRouter down" } };
        }
      };
    }
    assert.equal(body.model, RECEIPT_AI_OPENAI_MODEL);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  invoiceNumber: "77",
                  purchaseDate: "2026-02-01",
                  supplierName: "Fornecedor X",
                  items: [
                    {
                      productName: "Produto Y",
                      quantity: 2,
                      unitUsed: "kg",
                      unitPrice: 3
                    }
                  ]
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [{ id: "p1", name: "Produto Y", type: "insumo" }],
    suppliers: [{ id: "s1", name: "Fornecedor X" }]
  });

  assert.ok(n >= 2, "OpenRouter + OpenAI");
  assert.equal(out.invoiceNumber, "77");

  delete global.fetch;
});

test("parseReceiptWithAI: sem match no catálogo devolve nome extraído da NF", async () => {
  global.fetch = async (url) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  documentType: "danfe",
                  invoiceNumber: "46328",
                  purchaseDate: "2026-05-26",
                  supplierName: "BEIRAO DA SERRA",
                  productsSubtotal: 1570.1,
                  documentTotal: 1611.78,
                  icmsStAmount: 19.81,
                  items: [
                    {
                      productName:
                        "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120 Valor base calculo FCP R$ 209,40",
                      quantity: 1,
                      unitUsed: "CX",
                      unitPrice: 383.9,
                      lineTotal: 383.9
                    }
                  ]
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [],
    suppliers: [{ id: "s1", name: "BEIRAO DA SERRA" }]
  });

  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].productId, null);
  assert.equal(out.items[0].productName, "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120");
  assert.equal(out.items[0].rawProductName, "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120");
  assert.equal(out.items[0].catalogMatched, false);
  assert.ok(!out.items[0].missing.includes("produto"));

  delete global.fetch;
});

test("parseReceiptWithAI: devolve taxes, extras, metadados, parcelas e notes por item", async () => {
  global.fetch = async (url) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  documentType: "danfe",
                  invoiceNumber: "46328",
                  purchaseDate: "2026-05-26",
                  supplierName: "BEIRAO DA SERRA",
                  productsSubtotal: 1570.1,
                  documentTotal: 1611.78,
                  taxes: [
                    { name: "ICMS", amount: 159.75, confidence: "high" },
                    { name: "IPI", amount: 19.89, confidence: "high" },
                    { name: "ICMS-ST", amount: 19.81, confidence: "medium" }
                  ],
                  extras: [],
                  documentMetadata: {
                    orderNumber: "49473",
                    paymentTerms: "30 DIAS"
                  },
                  invoiceNotes: "PEDIDO 49473",
                  installments: [
                    { dueDate: "2026-06-09", amount: 1611.78, notes: "Duplicata 1", confidence: "high" }
                  ],
                  fieldConfidence: {
                    invoiceNumber: "high",
                    purchaseDate: "medium",
                    "metadata.orderNumber": "high"
                  },
                  items: [
                    {
                      productName: "ATUM PORT.MINERVA SOLIDO AZEITE CX 25X120",
                      quantity: 1,
                      unitUsed: "CX",
                      unitPrice: 383.9,
                      lineTotal: 383.9,
                      notes: "Valor FCP R$ 4,19",
                      notesConfidence: "medium"
                    }
                  ]
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [],
    suppliers: [{ id: "s1", name: "BEIRAO DA SERRA" }]
  });

  assert.equal(out.taxes.length, 3);
  assert.ok(out.taxes.some((t) => t.name === "ICMS" && t.amount === 159.75));
  assert.ok(out.taxes.some((t) => t.name === "IPI" && t.amount === 19.89));
  assert.ok(out.taxes.some((t) => t.name === "ICMS-ST" && t.amount === 19.81));
  assert.equal(out.documentMetadata.orderNumber, "49473");
  assert.ok(out.notes.includes("49473"));
  assert.equal(out.suggestedInstallments.length, 1);
  assert.equal(out.suggestedInstallments[0].amount, 1611.78);
  assert.equal(out.suggestedInstallments[0].dueDate, "2026-06-09");
  assert.equal(out.fieldConfidence.purchaseDate, "medium");
  assert.equal(out.items[0].notes, "Valor FCP R$ 4,19");
  assert.equal(out.items[0].notesConfidence, "medium");

  delete global.fetch;
});

test("parseReceiptWithAI: mussarela em KG na NF prevalece sobre catálogo un", async () => {
  global.fetch = async (url) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  invoiceNumber: "1001",
                  purchaseDate: "2026-05-20",
                  supplierName: "Laticínios X",
                  items: [
                    {
                      productName: "Queijo Mussarela",
                      quantity: 5.5,
                      unitUsed: "KG",
                      unitPrice: 34.5,
                      lineTotal: 189.75
                    }
                  ]
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENAI_API_KEY = "test-openai";
  process.env.OPENROUTER_API_KEY = "test-or";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [
      {
        id: "muss1",
        name: "Queijo Mussarela",
        category: "Laticínios",
        standard_unit: "un",
        type: "insumo",
        is_active: true
      }
    ],
    suppliers: [{ id: "s1", name: "Laticínios X" }]
  });

  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].productId, "muss1");
  assert.equal(out.items[0].unitUsed, "kg");
  assert.equal(out.items[0].quantity, 5.5);

  delete global.fetch;
});

test("formatReceiptAiErrorMessage: alias de receiptAiUserFacingMessage", async () => {
  const { formatReceiptAiErrorMessage, receiptAiUserFacingMessage } = await import(
    "../src/services/receiptAiService.js"
  );
  const technical = "You exceeded your current quota, please check billing";
  assert.equal(formatReceiptAiErrorMessage(technical), receiptAiUserFacingMessage(technical));
  assert.doesNotMatch(formatReceiptAiErrorMessage(technical), /quota|billing/i);
});
