#!/usr/bin/env node
/**
 * Zera dados operacionais + auth (exceto admin@lamego.local).
 * 1) Limpa o bucket Storage fiscal-receipts (API; SQL direto em storage.objects é bloqueado).
 * 2) Executa supabase/migrations/014_wipe_database_admin_only.sql no Postgres.
 *
 * Requer no .env da raiz: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE || !dbPassword) {
  console.error("[db-wipe-remote] Faltam SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_DB_PASSWORD no .env.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BUCKET = "fiscal-receipts";

/** Lista e remove ficheiros (inclui subpastas tipo purchaseId/arquivo.pdf). */
async function emptyBucketRecursive(prefix = "") {
  const { data: entries, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const entry of entries || []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.metadata) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove([path]);
      if (rmErr) throw rmErr;
    } else {
      await emptyBucketRecursive(path);
    }
  }
}

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const dbHost = `db.${projectRef}.supabase.co`;

const sqlPath = path.resolve(__dirname, "../supabase/migrations/014_wipe_database_admin_only.sql");
const sql = await fs.readFile(sqlPath, "utf8");

console.log(`[db-wipe-remote] A limpar bucket ${BUCKET}…`);
await emptyBucketRecursive("");
console.log(`[db-wipe-remote] Bucket ${BUCKET} limpo.`);

const client = new Client({
  host: dbHost,
  port: 5432,
  user: "postgres",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

console.log(`[db-wipe-remote] A executar SQL: ${sqlPath}`);
await client.connect();
try {
  await client.query(sql);
  console.log("[db-wipe-remote] SQL concluído (dados públicos zerados).");
} finally {
  await client.end();
}

const ADMIN_EMAIL = "admin@lamego.local";
for (let page = 1; page <= 50; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  const users = data?.users || [];
  for (const u of users) {
    if ((u.email || "").toLowerCase() === ADMIN_EMAIL) continue;
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) throw delErr;
    console.log(`[db-wipe-remote] Auth removido: ${u.email || u.id}`);
  }
  if (users.length < 200) break;
}
console.log(`[db-wipe-remote] Auth: mantido apenas ${ADMIN_EMAIL} (se existia).`);

console.log("[db-wipe-remote] Feito. Sugestão: npm run supabase:bootstrap:admin (ou supabase:bootstrap com gerente demo).");
