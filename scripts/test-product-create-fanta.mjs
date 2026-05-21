#!/usr/bin/env node
/**
 * Teste: criar produto "fanta uva" via API (mesmo fluxo do botão + Adicionar produto).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env", ".env.production"]) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const apiRoot = "https://painellamego.com.br/api";
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const email = process.env.E2E_MANAGER_EMAIL || "britorodrigues67@gmail.com";
const password = process.env.E2E_MANAGER_PASSWORD || "BritoLeblon25";
const productName = process.argv[2] || "fanta uva";

async function login() {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error_description || body?.msg || `Login falhou (${res.status})`);
  return body.access_token;
}

async function main() {
  if (!supabaseUrl || !anonKey) {
    console.error("Falta SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env");
    process.exit(1);
  }
  console.log("Login…", email);
  const token = await login();
  console.log("OK login");

  const searchRes = await fetch(`${apiRoot}/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const products = await searchRes.json();
  const existing = Array.isArray(products)
    ? products.find((p) => String(p.name).toLowerCase() === productName.toLowerCase())
    : null;
  if (existing) {
    console.log(`Produto já existe: id=${existing.id} name="${existing.name}" category="${existing.category}"`);
    process.exit(0);
  }

  console.log(`Criar produto: "${productName}"…`);
  const createRes = await fetch(`${apiRoot}/catalog/products/quick`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: productName,
      type: "venda",
      category: "Bebidas"
    })
  });
  const data = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    console.error("Falha criar produto:", createRes.status, data);
    process.exit(1);
  }
  console.log("OK produto criado:", {
    id: data.id,
    name: data.name,
    category: data.category,
    type: data.type,
    reused: data.reused
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
