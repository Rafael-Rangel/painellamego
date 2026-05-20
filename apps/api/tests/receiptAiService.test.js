import test from "node:test";
import assert from "node:assert/strict";

function isOpenRouterUrl(url) {
  return String(url || "").includes("openrouter.ai");
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

test("parseReceiptWithAI: PDF usa content type file (não image_url)", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (!isOpenRouterUrl(url)) return fakePostgrestEmptyArray();
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
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
                })
              }
            }
          ]
        };
      }
    };
  };

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const pdfBuf = Buffer.from("%PDF-1.4 fake", "utf8");
  const out = await parseReceiptWithAI({
    imageBuffer: pdfBuf,
    mimeType: "application/pdf",
    products: [{ id: "p1", name: "Produto Y", type: "insumo" }],
    suppliers: [{ id: "s1", name: "Fornecedor X" }]
  });

  assert.equal(calls.length, 1);
  const content = calls[0].body.messages[0].content;
  assert.equal(content[0].type, "file", "PDF deve vir antes do texto");
  const filePart = content[0];
  assert.ok(String(filePart.file?.file_data || "").startsWith("data:application/pdf;base64,"));
  assert.ok(Array.isArray(calls[0].body.plugins));
  assert.equal(out.invoiceNumber, "123");
  assert.equal(out.items.length, 1);
  assert.ok(out.items[0].productId);

  delete global.fetch;
});

test("parseReceiptWithAI: JPEG usa image_url", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    if (!isOpenRouterUrl(url)) return fakePostgrestEmptyArray();
    calls.push({ body: JSON.parse(init.body) });
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

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [],
    suppliers: []
  });

  const content = calls[0].body.messages[0].content;
  const img = content.find((c) => c.type === "image_url");
  assert.ok(img);
  assert.equal(content[0].type, "image_url", "imagem deve vir antes do texto");
  assert.ok(String(img.image_url?.url || "").startsWith("data:image/jpeg;base64,"));
  assert.ok(!calls[0].body.plugins);

  delete global.fetch;
});

test("parseReceiptWithAI: falha do provider na 1ª chamada faz retry sem response_format", async () => {
  let n = 0;
  global.fetch = async (url, init) => {
    if (!isOpenRouterUrl(url)) return fakePostgrestEmptyArray();
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

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

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

test("parseReceiptWithAI: esgota modelo principal e usa OPENROUTER_FALLBACK_MODEL", async () => {
  let n = 0;
  global.fetch = async (url, init) => {
    if (!isOpenRouterUrl(url)) return fakePostgrestEmptyArray();
    n += 1;
    const body = JSON.parse(init.body);
    const model = body.model;
    if (model === "google/gemini-2.0-flash-001") {
      return {
        ok: false,
        status: 502,
        async json() {
          return { error: { message: "Provider returned error" } };
        }
      };
    }
    if (model === "google/gemini-2.5-flash") {
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
    }
    throw new Error(`modelo inesperado: ${model}`);
  };

  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "google/gemini-2.0-flash-001";
  process.env.OPENROUTER_FALLBACK_MODEL = "google/gemini-2.5-flash";

  const { parseReceiptWithAI } = await import("../src/services/receiptAiService.js");
  const jpegBuf = Buffer.from("ff", "hex");
  const out = await parseReceiptWithAI({
    imageBuffer: jpegBuf,
    mimeType: "image/jpeg",
    products: [{ id: "p1", name: "Produto Y", type: "insumo" }],
    suppliers: [{ id: "s1", name: "Fornecedor X" }]
  });

  assert.equal(n, 3, "2 falhas no principal + 1 sucesso no fallback");
  assert.equal(out.invoiceNumber, "77");

  delete global.fetch;
});
