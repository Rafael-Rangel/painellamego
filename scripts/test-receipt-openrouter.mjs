#!/usr/bin/env node
/**
 * Teste de integração: OpenRouter + parseReceiptWithAI (imagem mínima).
 * Uso na raiz do repo: node scripts/test-receipt-openrouter.mjs
 * Requer OPENROUTER_API_KEY no .env (raiz ou apps/api).
 */
import dotenv from "dotenv";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "apps", "api", ".env") });

const { parseReceiptWithAI } = await import("../apps/api/src/services/receiptAiService.js");

// JPEG 1×1 pixel (válido) — não é nota real; valida chamada, JSON e encadeamento.
const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64"
);

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("SKIP: defina OPENROUTER_API_KEY no .env para rodar este teste.");
    process.exit(2);
  }

  const products = [
    { id: "11111111-1111-1111-1111-111111111111", name: "Farinha de trigo", type: "insumo" }
  ];
  const suppliers = [{ id: "22222222-2222-2222-2222-222222222222", name: "Distribuidora Sul" }];

  const out = await parseReceiptWithAI({
    imageBuffer: tinyJpeg,
    mimeType: "image/jpeg",
    products,
    suppliers
  });

  const okShape =
    out &&
    typeof out === "object" &&
    Array.isArray(out.items) &&
    Array.isArray(out.missingGlobal) &&
    ("invoiceNumber" in out || out.invoiceNumber === null);

  if (!okShape) {
    console.error("FAIL: formato de resposta inesperado", out);
    process.exit(1);
  }

  console.log("OK: OpenRouter respondeu e o serviço retornou objeto válido.");
  console.log("  model (env):", process.env.OPENROUTER_MODEL || "(padrão google/gemini-2.0-flash-001)");
  console.log("  itens:", out.items.length, "| missingGlobal:", out.missingGlobal.length);
}

main().catch((e) => {
  const msg = String(e.message || "");
  if (/insufficient credits/i.test(msg)) {
    console.error("PARCIAL_OK: autenticação e modelo foram aceitos pela OpenRouter.");
    console.error("  Falta saldo na conta: https://openrouter.ai/settings/credits");
    console.error("  Depois disso, rode de novo: npm run test:openrouter");
    process.exit(3);
  }
  console.error("FAIL:", msg);
  process.exit(1);
});
