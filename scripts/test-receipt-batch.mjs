#!/usr/bin/env node
/**
 * Regressão: parseReceiptWithAI em lote contra golden opcional.
 * Uso (raiz do repo):
 *   node scripts/test-receipt-batch.mjs
 *   node scripts/test-receipt-batch.mjs --only golden
 *   RECEIPT_BATCH_LIMIT=2 node scripts/test-receipt-batch.mjs
 * Requer OPENAI_API_KEY (e opcional OPENROUTER_API_KEY para fallback) no .env
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECEIPT_AI_OPENAI_MODEL,
  RECEIPT_AI_OPENROUTER_FALLBACK_MODEL
} from "../apps/api/src/receiptAiModels.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "apps", "api", ".env") });

const samplesDir = path.join(root, "scripts/fixtures/receipt-samples");
const goldenDir = path.join(root, "scripts/fixtures/receipt-golden");
const manifestPath = path.join(goldenDir, "manifest.json");

const onlyGolden = process.argv.includes("--only") && process.argv.includes("golden");
const limit = Number(process.env.RECEIPT_BATCH_LIMIT || 0) || 0;

function mimeFromPath(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".pdf") return "application/pdf";
  return "image/jpeg";
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function supplierMatches(actual, expected) {
  const a = norm(actual);
  const e = norm(expected);
  return a.includes(e) || e.includes(a);
}

function inRange(value, range) {
  if (value == null || !range) return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (range.min != null && n < range.min) return false;
  if (range.max != null && n > range.max) return false;
  return true;
}

function findItemByContains(items, fragments) {
  const frags = (fragments || []).map((f) => norm(f));
  return (items || []).find((it) => {
    const name = norm(it.rawProductName || it.productName || "");
    return frags.every((f) => name.includes(f));
  });
}

function validateGolden(result, golden) {
  const errors = [];
  if (golden.documentType && result.documentType && golden.documentType !== result.documentType) {
    errors.push(`documentType: esperado ${golden.documentType}, obteve ${result.documentType}`);
  }
  if (golden.supplierName && !supplierMatches(result.supplierName || result.supplierSuggestion?.name || "", golden.supplierName)) {
    errors.push(`fornecedor: esperado contém "${golden.supplierName}"`);
  }
  if (golden.minItems && (result.items?.length || 0) < golden.minItems) {
    errors.push(`itens: mínimo ${golden.minItems}, obteve ${result.items?.length || 0}`);
  }
  for (const exp of golden.items || []) {
    const row = findItemByContains(result.items, exp.productNameContains);
    if (!row) {
      errors.push(`item não encontrado: ${(exp.productNameContains || []).join(" ")}`);
      continue;
    }
    if (exp.unitUsed && norm(row.unitUsed) !== norm(exp.unitUsed)) {
      errors.push(`unidade "${exp.productNameContains?.[0]}": esperado ${exp.unitUsed}, obteve ${row.unitUsed}`);
    }
    if (!inRange(row.quantity, exp.quantity)) {
      errors.push(`qty "${exp.productNameContains?.[0]}": ${row.quantity} fora de ${JSON.stringify(exp.quantity)}`);
    }
    if (!inRange(row.unitPrice, exp.unitPrice)) {
      errors.push(`preço "${exp.productNameContains?.[0]}": ${row.unitPrice} fora de ${JSON.stringify(exp.unitPrice)}`);
    }
    if (!inRange(row.lineTotal, exp.lineTotal)) {
      errors.push(`total linha "${exp.productNameContains?.[0]}": ${row.lineTotal}`);
    }
  }
  return errors;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Defina OPENAI_API_KEY no .env");
    process.exit(1);
  }

  const { parseReceiptWithAI } = await import("../apps/api/src/services/receiptAiService.js");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const goldenByImage = new Map((manifest.samples || []).map((s) => [s.image, s]));

  let files = fs.readdirSync(samplesDir).filter((f) => /\.(png|jpe?g|pdf)$/i.test(f));
  if (onlyGolden) {
    files = files.filter((f) => goldenByImage.has(f));
  }
  if (limit > 0) files = files.slice(0, limit);

  console.log(`Modelo OpenAI: ${RECEIPT_AI_OPENAI_MODEL}`);
  console.log(`Fallback OpenRouter: ${RECEIPT_AI_OPENROUTER_FALLBACK_MODEL}`);
  console.log(`Amostras: ${files.length}\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(samplesDir, file);
    const buf = fs.readFileSync(filePath);
    const entry = goldenByImage.get(file);
    const label = entry?.notes || file;
    process.stdout.write(`→ ${label} ... `);

    try {
      const result = await parseReceiptWithAI({
        imageBuffer: buf,
        mimeType: mimeFromPath(filePath),
        products: [],
        suppliers: []
      });

      if (!entry?.golden) {
        console.log(`ok (${result.items?.length || 0} itens, sem golden)`);
        skipped += 1;
        continue;
      }

      const golden = JSON.parse(fs.readFileSync(path.join(goldenDir, entry.golden), "utf8"));
      const errs = validateGolden(result, golden);
      if (errs.length) {
        console.log("FALHOU");
        for (const e of errs) console.log(`    - ${e}`);
        failed += 1;
      } else {
        console.log(`ok (${result.items?.length} itens)`);
        passed += 1;
      }
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nResumo: ${passed} passou (golden), ${skipped} sem golden, ${failed} falhou/erro`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
