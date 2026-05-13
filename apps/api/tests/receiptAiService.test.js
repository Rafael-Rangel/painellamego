import test from "node:test";
import assert from "node:assert/strict";

test("parseReceiptWithAI: PDF usa content type file (não image_url)", async () => {
  const calls = [];
  global.fetch = async (url, init) => {
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
  const filePart = content.find((c) => c.type === "file");
  assert.ok(filePart, "deve enviar PDF como type=file");
  assert.ok(String(filePart.file?.file_data || "").startsWith("data:application/pdf;base64,"));
  assert.ok(Array.isArray(calls[0].body.plugins));
  assert.equal(out.invoiceNumber, "123");
  assert.equal(out.items.length, 1);
  assert.ok(out.items[0].productId);

  delete global.fetch;
});

test("parseReceiptWithAI: JPEG usa image_url", async () => {
  const calls = [];
  global.fetch = async (_url, init) => {
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
  assert.ok(String(img.image_url?.url || "").startsWith("data:image/jpeg;base64,"));
  assert.ok(!calls[0].body.plugins);

  delete global.fetch;
});
