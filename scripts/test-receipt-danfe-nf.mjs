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

const ASSETS_DIR =
  "C:/Users/aftor/.cursor/projects/c-Users-aftor-Nova-pasta/assets";

const ALT_PATHS = [
  `${ASSETS_DIR}/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-1a3f75cd-19f5-45a6-bf04-deef59090ed2.png`,
  `${ASSETS_DIR}/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-76225b95-62fd-4250-a81e-e967a93736ee.png`,
  `${ASSETS_DIR}/c__Users_aftor_AppData_Roaming_Cursor_User_workspaceStorage_d593c4a86a57f8b8062a66c6059d3873_images_image-c3771a8e-8d5d-40c0-a391-fd17b93881a3.png`
];

function resolveImages() {
  if (ALT_PATHS.every((p) => fs.existsSync(p))) return ALT_PATHS;
  throw new Error("Imagens da NF não encontradas. Envie as 3 fotos novamente ao chat.");
}

const { parseReceiptWithAI } = await import("../apps/api/src/services/receiptAiService.js");

function assertApprox(actual, expected, label, tolerance = 0.02) {
  if (!Number.isFinite(actual)) {
    throw new Error(`${label}: valor inválido (${actual})`);
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: esperado ~${expected}, obtido ${actual}`);
  }
}

function findTax(out, namePart) {
  return out.taxes?.find((t) => String(t.name).toLowerCase().includes(namePart.toLowerCase()));
}

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
  console.log("Impostos:", out.taxes?.map((t) => `${t.name}=${t.amount}`).join(", ") || "n/d");
  console.log("Extras:", out.extras?.map((e) => `${e.name}=${e.amount}`).join(", ") || "n/d");
  console.log("Pedido:", out.documentMetadata?.orderNumber || "n/d");
  console.log("Parcelas:", out.suggestedInstallments?.length || 0);
  console.log("Totais doc:", out.documentTotals);
  console.log("Avisos:", out.missingGlobal?.length || 0);

  console.log("\n--- Itens ---");
  for (const [i, it] of out.items.entries()) {
    console.log(
      `${i + 1}. ${it.productName || it.rawProductName || "?"} | qtd=${it.quantity} ${it.unitUsed} | un=${it.unitPrice} | total=${it.lineTotal} | obs=${it.notes || "—"} | catálogo=${it.catalogMatched ? "sim" : "não"}`
    );
  }

  if (process.argv.includes("--json")) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(out, null, 2));
  }

  if (out.items.length < 3) {
    console.warn("\nAVISO: esperado pelo menos 3 produtos nesta NF.");
    process.exit(4);
  }

  const icms = findTax(out, "icms");
  const ipi = findTax(out, "ipi");
  const icmsSt = findTax(out, "st");
  assertApprox(icms?.amount, 159.75, "ICMS");
  assertApprox(ipi?.amount, 19.89, "IPI");
  assertApprox(icmsSt?.amount, 19.81, "ICMS-ST");

  const order = String(out.documentMetadata?.orderNumber || out.notes || "");
  if (!order.includes("49473")) {
    throw new Error("Pedido 49473 não encontrado em documentMetadata/notes");
  }

  if (out.suggestedInstallments?.length) {
    const inst = out.suggestedInstallments[0];
    assertApprox(inst.amount, 1611.78, "Parcela 1");
    console.log("\nOK: parcela", inst.dueDate, inst.amount);
  } else {
    console.warn("\nAVISO: nenhuma parcela sugerida (esperado 1× R$ 1.611,78).");
  }

  console.log("\nOK: asserts DANFE Beirão da Serra passaram.");
}

main().catch((e) => {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
