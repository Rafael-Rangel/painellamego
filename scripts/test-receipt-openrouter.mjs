#!/usr/bin/env node
/**
 * Teste de integração: OpenRouter + parseReceiptWithAI (imagem mínima).
 * Uso na raiz do repo:
 *   node scripts/test-receipt-openrouter.mjs
 *   node scripts/test-receipt-openrouter.mjs https://exemplo.com/nota.jpg
 *   node scripts/test-receipt-openrouter.mjs /caminho/local/nota.png
 *   node scripts/test-receipt-openrouter.mjs nota.png --json
 * Catálogo opcional (para testar match com cadastro):
 *   RECEIPT_TEST_CATALOG='{"products":[...],"suppliers":[...]}' node scripts/test-receipt-openrouter.mjs nota.png --json
 * Requer OPENROUTER_API_KEY no .env (raiz ou apps/api).
 */
import dotenv from "dotenv";
import { Buffer } from "node:buffer";
import fs from "node:fs";
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

function mimeFromPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "image/jpeg";
}

async function loadImageArg(arg) {
  if (!arg) {
    return { imageBuffer: tinyJpeg, mimeType: "image/jpeg", label: "JPEG 1×1 (fixture)" };
  }
  if (/^https?:\/\//i.test(arg)) {
    const res = await fetch(arg, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${arg}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime =
      ct && ct !== "application/octet-stream"
        ? ct
        : mimeFromPath(new URL(arg).pathname || "") || "image/jpeg";
    return { imageBuffer: buf, mimeType: mime, label: `URL (${buf.length} bytes)` };
  }
  const abs = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  if (!fs.existsSync(abs)) throw new Error(`Ficheiro não encontrado: ${abs}`);
  const buf = fs.readFileSync(abs);
  return { imageBuffer: buf, mimeType: mimeFromPath(abs), label: `ficheiro ${path.basename(abs)} (${buf.length} bytes)` };
}

function argvImagePath() {
  const skip = new Set(["--json"]);
  const args = process.argv.slice(2).filter((a) => !skip.has(a));
  return args[0] || null;
}

function loadCatalogFromEnv() {
  const raw = process.env.RECEIPT_TEST_CATALOG;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    return {
      products: Array.isArray(c.products) ? c.products : [],
      suppliers: Array.isArray(c.suppliers) ? c.suppliers : []
    };
  } catch (e) {
    console.error("RECEIPT_TEST_CATALOG: JSON inválido:", e.message);
    process.exit(1);
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("SKIP: defina OPENROUTER_API_KEY no .env para rodar este teste.");
    process.exit(2);
  }

  const arg = argvImagePath();
  const printJson = process.argv.includes("--json");
  const { imageBuffer, mimeType, label } = await loadImageArg(arg);
  console.log("Fonte da imagem:", label, "| mime:", mimeType);

  const fromEnv = loadCatalogFromEnv();
  const products = fromEnv?.products?.length
    ? fromEnv.products
    : [{ id: "11111111-1111-1111-1111-111111111111", name: "Farinha de trigo", type: "insumo" }];
  const suppliers = fromEnv?.suppliers?.length
    ? fromEnv.suppliers
    : [{ id: "22222222-2222-2222-2222-222222222222", name: "Distribuidora Sul" }];

  const out = await parseReceiptWithAI({
    imageBuffer,
    mimeType,
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
  if (printJson) {
    console.log("\n--- JSON completo ---");
    console.log(JSON.stringify(out, null, 2));
  }
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
