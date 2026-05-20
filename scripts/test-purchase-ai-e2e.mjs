#!/usr/bin/env node
/**
 * E2E: login gerente → catálogo → analisar imagem (IA) → registar compra.
 *
 * Uso:
 *   E2E_BASE_URL=https://painellamego.com.br \
 *   E2E_MANAGER_EMAIL=gerente.centro@lamego.com.br \
 *   E2E_MANAGER_PASSWORD='...' \
 *   node scripts/test-purchase-ai-e2e.mjs
 *
 * Local API:
 *   E2E_BASE_URL=http://localhost:3333 node scripts/test-purchase-ai-e2e.mjs
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.production") });
dotenv.config({ path: path.join(root, "apps", "api", ".env") });

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3333").replace(/\/$/, "");
const apiRoot = baseUrl.includes("/api") ? baseUrl : `${baseUrl}/api`;
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const email = process.env.E2E_MANAGER_EMAIL || "britorodrigues67@gmail.com";
const password = process.env.E2E_MANAGER_PASSWORD || "BritoLeblon25";
const fixtureCandidates = [
  path.join(root, "WhatsApp Image 2026-05-20 at 13.27.35.jpeg"),
  path.join(root, "scripts/fixtures/receipt-samples/WhatsApp_Image_2026-05-13_at_10.21.36-9f050192-56c5-4a78-bbb6-1e2567ea608e.png")
];
const fixture = fixtureCandidates.find((p) => fs.existsSync(p));
const skipPurchase = process.argv.includes("--skip-purchase");

function fail(step, err, extra = {}) {
  console.error(`\n[FAIL] ${step}`);
  if (err?.message) console.error(err.message);
  if (extra.status) console.error("HTTP", extra.status, extra.body?.slice?.(0, 400) || extra.body);
  process.exit(1);
}

async function login() {
  if (!supabaseUrl || !anonKey) {
    fail("login", new Error("Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env"));
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail("login", new Error(body?.error_description || body?.msg || "Auth falhou"), { status: res.status, body });
  return body.access_token;
}

async function apiFetch(token, method, pathname, { json, formData, timeoutMs = 180_000 } = {}) {
  const url = `${apiRoot}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (formData) {
    body = formData;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { res, data };
  } catch (e) {
    if (e?.name === "AbortError") throw new Error(`Timeout (${timeoutMs}ms) em ${method} ${pathname}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log("E2E base:", apiRoot);
  if (!fixture) fail("fixture", new Error(`Imagem não encontrada. Tentou: ${fixtureCandidates.join(", ")}`));

  console.log("[1/5] Login gerente…");
  const token = await login();
  console.log("  OK token obtido");

  console.log("[2/5] Catálogo (GET products)…");
  const cat = await apiFetch(token, "GET", "/catalog/products", { timeoutMs: 60_000 });
  if (!cat.res.ok) fail("catalog", new Error("products"), { status: cat.res.status, body: cat.data });
  const products = Array.isArray(cat.data) ? cat.data : [];
  console.log(`  OK ${products.length} produtos`);

  const supRes = await apiFetch(token, "GET", "/catalog/suppliers", { timeoutMs: 30_000 });
  if (!supRes.res.ok) fail("suppliers", new Error("suppliers"), { status: supRes.res.status, body: supRes.data });
  const suppliers = Array.isArray(supRes.data) ? supRes.data : [];
  if (!suppliers.length) fail("suppliers", new Error("Nenhum fornecedor no catálogo"));
  const supplierId = suppliers[0].id;
  console.log(`  OK fornecedor: ${suppliers[0].name}`);

  console.log("[3/5] Analisar nota (POST receipt-ai-parse)…");
  const form = new FormData();
  const mime = fixture.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const blob = new Blob([fs.readFileSync(fixture)], { type: mime });
  form.append("receipts", blob, path.basename(fixture));
  form.append("supplierId", supplierId);
  const t0 = Date.now();
  const ai = await apiFetch(token, "POST", "/purchases/receipt-ai-parse", { formData: form, timeoutMs: 300_000 });
  const ms = Date.now() - t0;
  if (!ai.res.ok) fail("receipt-ai-parse", new Error("IA falhou"), { status: ai.res.status, body: ai.data });
  const items = ai.data?.items || [];
  console.log(`  OK em ${(ms / 1000).toFixed(1)}s · ${items.length} linha(s) · NF ${ai.data?.invoiceNumber || "n/d"}`);
  if (!items.length) fail("receipt-ai-parse", new Error("IA não devolveu itens"));

  if (skipPurchase) {
    console.log("\n[OK] E2E parcial (--skip-purchase).");
    return;
  }

  console.log("[4/5] Criar produto rápido se necessário…");
  const today = new Date().toISOString().slice(0, 10);
  const payloadItems = [];
  for (const row of items.slice(0, 3)) {
    let productId = row.productId;
    if (!productId) {
      const label = String(row.aiRawProductName || row.productName || "Item E2E").trim();
      const qc = await apiFetch(token, "POST", "/catalog/products/quick", {
        json: {
          name: label.slice(0, 120),
          type: row.lineType === "venda" ? "venda" : "insumo",
          category: row.category || "Outros",
          supplierId
        },
        timeoutMs: 30_000
      });
      if (!qc.res.ok) fail("products/quick", new Error(label), { status: qc.res.status, body: qc.data });
      productId = qc.data?.id;
    }
    if (!productId) fail("product", new Error("Sem productId na linha"));
    payloadItems.push({
      productId,
      supplierId,
      unitPrice: Number(row.unitPrice) > 0 ? Number(row.unitPrice) : 1,
      unitUsed: row.unitUsed || "un",
      quantity: Number(row.quantity) > 0 ? Number(row.quantity) : 1,
      purchaseDate: today,
      weekOfMonth: Math.min(5, Math.max(1, Math.ceil(new Date(today).getDate() / 7))),
      lineType: row.lineType === "venda" ? "venda" : "insumo"
    });
  }

  console.log("[5/5] Registar compra (POST /purchases)…");
  const purchaseForm = new FormData();
  purchaseForm.append("invoiceNumber", `E2E-${Date.now()}`);
  purchaseForm.append("items", JSON.stringify(payloadItems));
  purchaseForm.append("receipts", blob, path.basename(fixture));
  const purch = await apiFetch(token, "POST", "/purchases", { formData: purchaseForm, timeoutMs: 120_000 });
  if (!purch.res.ok) fail("purchases", new Error("Registo falhou"), { status: purch.res.status, body: purch.data });
  console.log(`  OK purchaseId=${purch.data?.purchaseId}`);
  console.log("\n[OK] E2E completo: imagem → IA → registo.");
}

main().catch((e) => fail("unexpected", e));
