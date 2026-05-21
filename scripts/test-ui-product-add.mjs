#!/usr/bin/env node
/**
 * Teste UI: login → compra com IA → digitar produto → clicar + Adicionar
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env", ".env.production"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const base = "https://painellamego.com.br";
const email = process.env.E2E_MANAGER_EMAIL || "britorodrigues67@gmail.com";
const password = process.env.E2E_MANAGER_PASSWORD || "BritoLeblon25";
const productQuery = process.argv[2] || "fanta uva";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(manager|admin)/, { timeout: 30_000 });

    await page.goto(`${base}/manager/new-purchase/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('label:has-text("Produto")', { timeout: 30_000 });

    const draft = page.locator(".purchase-ai-draft-inner");
    const catInput = draft.locator('label:has-text("Categoria")').locator("..").locator("input").first();
    await catInput.click();
    await catInput.fill("Bebidas");
    await page.locator("button.ss-option-create, button.ss-option-btn").filter({ hasText: /Bebidas/i }).first().click({ timeout: 5000 }).catch(() => {});

    const productInput = draft.locator('label:has-text("Produto")').locator("..").locator("input").first();
    await productInput.click();
    await productInput.fill("");
    await productInput.fill(productQuery);
    await page.waitForTimeout(1200);

    const options = await page.locator(".ms-popover button").allTextContents();
    console.log("Opções no dropdown:", options.slice(0, 12));

    const createBtn = page.locator("button.ss-option-create").filter({ hasText: /Adicionar produto/i }).first();
    const visible = await createBtn.isVisible().catch(() => false);
    if (!visible) {
      await page.screenshot({ path: path.join(root, "scripts", "test-ui-product-add-fail.png"), fullPage: true });
      throw new Error(`Botão + Adicionar produto não visível. Opções: ${options.join(" | ")}`);
    }
    await createBtn.click();

    await page.waitForTimeout(2500);

    const toast = page.locator(".toast, [class*='toast']").first();
    const toastText = (await toast.textContent().catch(() => "")) || "";

    const inputValue = await productInput.inputValue();
    console.log("Toast:", toastText.trim() || "(sem toast visível)");
    console.log("Valor no input após criar:", inputValue);

    if (!/adicionado|já existia/i.test(toastText) && !inputValue) {
      throw new Error("Não houve confirmação de produto criado/selecionado");
    }
    console.log("OK teste UI: botão + Adicionar produto clicável e fluxo concluído");
  } finally {
    if (errors.length) console.error("Erros JS na página:", errors);
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FALHA UI:", e.message);
  process.exit(1);
});
