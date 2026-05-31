#!/usr/bin/env node
/**
 * Teste de integração com as 3 fotos da NF BEIRAO/MINERVA (mesmo documento, várias páginas).
 * Uso: node scripts/test-receipt-danfe-nf.mjs [--json]
 * Requer OPENAI_API_KEY no .env
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "apps", "api", ".env") });

const ALT_PATHS = [
  "C:/Users/aftor/.cursor/projects/c-Users-aftor-Nova-pasta/assets/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-0e0d1ce1-324b-4e69-804d-020a9517cb2f.png",
  "C:/Users/aftor/.cursor/projects/c-Users-aftor-Nova-pasta/assets/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-7f22f272-8dd9-470a-895b-a130ef6da2f8.png",
  "C:/Users/aftor/.cursor/projects/c-Users-aftor-Nova-pasta/assets/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-09f29a2c-e66d-4bf7-9c2d-e4962ec7d0f6.png"
];

function resolveImages() {
  if (ALT_PATHS.every((p) => fs.existsSync(p))) return ALT_PATHS;
  throw new Error("Imagens da NF não encontradas. Envie as 3 fotos novamente ao chat.");
}

const { parseReceiptWithAI } = await import("../apps/api/src/services/receiptAiService.js");

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("SKIP: defina OPENAI_API_KEY no .env");
    process.exit(2);
  }

  const paths = resolveImages();
  const documents = paths.map((p) => ({
    buffer: fs.readFileSync(p),
    mimeType: "image/png"
  }));

  console.log("Analisando NF com", documents.length, "página(s)...");
  const started = Date.now();
  const out = await parseReceiptWithAI({
    documents,
    mimeType: "image/png",
    products: [],
    suppliers: [{ id: "00000000-0000-0000-0000-000000000001", name: "BEIRAO DA SERRA RIO IMPORTACAO DIST.LTDA" }]
  });
  const ms = Date.now() - started;

  console.log("\n--- Resumo ---");
  console.log("Tempo:", ms, "ms");
  console.log("Tipo:", out.documentType);
  console.log("NF:", out.invoiceNumber);
  console.log("Data:", out.purchaseDate);
  console.log("Fornecedor:", out.supplierName, out.supplierSuggestion?.confidence);
  console.log("Itens:", out.items.length);
  console.log("Totais doc:", out.documentTotals);
  console.log("Avisos:", out.missingGlobal?.length || 0);

  console.log("\n--- Itens ---");
  for (const [i, it] of out.items.entries()) {
    console.log(
      `${i + 1}. ${it.productName || it.rawProductName || "?"} | qtd=${it.quantity} ${it.unitUsed} | un=${it.unitPrice} | total=${it.lineTotal} | catálogo=${it.catalogMatched ? "sim" : "não"}`
    );
  }

  if (process.argv.includes("--json")) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(out, null, 2));
  }

  if (out.items.length < 3) {
    console.warn("\nAVISO: esperado pelo menos 3 produtos nesta NF (Atum, Sardinha, Margarina + outros).");
    process.exit(4);
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
