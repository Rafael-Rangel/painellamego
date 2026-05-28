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

  assert.ok(calls.some((c) => isOpenAiUrl(c.url)));
  const orCall = calls.find((c) => isOpenRouterUrl(c.url));
  assert.ok(orCall);
  const content = orCall.body.messages[0].content;
  assert.equal(content[0].type, "file");
  assert.ok(Array.isArray(orCall.body.plugins));
  assert.equal(out.invoiceNumber, "123");

  delete global.fetch;
});

test("parseReceiptWithAI: JPEG usa OpenAI com image_url detail auto", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    calls.push({ url, body: JSON.parse(init.body) });
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

  assert.equal(calls.length, 1);
  assert.ok(isOpenAiUrl(calls[0].url));
  assert.equal(calls[0].body.model, RECEIPT_AI_OPENAI_MODEL);
  const content = calls[0].body.messages[0].content;
  const img = content.find((c) => c.type === "image_url");
  assert.ok(img);
  assert.equal(img.image_url.detail, "auto");
  assert.ok(!calls[0].body.plugins);

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

test("parseReceiptWithAI: esgota OpenAI e usa fallback OpenRouter fixo", async () => {
  let n = 0;
  global.fetch = async (url, init) => {
    if (!isAiChatUrl(url)) return fakePostgrestEmptyArray();
    n += 1;
    const body = JSON.parse(init.body);
    if (isOpenAiUrl(url)) {
      return {
        ok: false,
        status: 502,
        async json() {
          return { error: { message: "OpenAI down" } };
        }
      };
    }
    assert.equal(body.model, RECEIPT_AI_OPENROUTER_FALLBACK_MODEL);
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

  assert.ok(n >= 3, "2+ tentativas OpenAI + 1 OpenRouter");
  assert.equal(out.invoiceNumber, "77");

  delete global.fetch;
});
