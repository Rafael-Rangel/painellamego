#!/usr/bin/env node
/**
 * Copia arquivos do bucket fiscal-receipts (antigo -> novo).
 * Requer no .env ou variáveis de ambiente:
 *   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY
 *   NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const OLD_URL = process.env.OLD_SUPABASE_URL || process.env.MIGRATE_OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || process.env.MIGRATE_OLD_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL || process.env.SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OLD_DB_URL =
  process.env.OLD_DB_URL ||
  (process.env.MIGRATE_OLD_PROJECT_REF && process.env.MIGRATE_OLD_DB_PASSWORD
    ? `postgresql://postgres.${process.env.MIGRATE_OLD_PROJECT_REF}:${encodeURIComponent(process.env.MIGRATE_OLD_DB_PASSWORD)}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`
    : null);

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY || !OLD_DB_URL) {
  console.error("[storage] Faltam credenciais OLD_/NEW_ ou OLD_DB_URL.");
  process.exit(1);
}

const oldStorage = createClient(OLD_URL, OLD_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const newStorage = createClient(NEW_URL, NEW_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const pgClient = new pg.Client({ connectionString: OLD_DB_URL, ssl: { rejectUnauthorized: false } });
await pgClient.connect();

const { rows } = await pgClient.query(
  `SELECT name, metadata->>'mimetype' AS mime_type, metadata->>'size' AS size
   FROM storage.objects
   WHERE bucket_id = 'fiscal-receipts'
   ORDER BY name`
);
await pgClient.end();

console.log(`[storage] ${rows.length} arquivo(s) a copiar...`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  const objectPath = row.name;
  process.stdout.write(`[storage] ${objectPath} ... `);
  try {
    const { data: blob, error: dlErr } = await oldStorage.storage.from("fiscal-receipts").download(objectPath);
    if (dlErr) throw dlErr;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await newStorage.storage.from("fiscal-receipts").upload(objectPath, buffer, {
      upsert: true,
      contentType: row.mime_type || "application/octet-stream"
    });
    if (upErr) throw upErr;
    ok += 1;
    console.log("OK");
  } catch (err) {
    fail += 1;
    console.log("FAIL", err.message || err);
  }
}

console.log(`[storage] Concluído: ${ok} ok, ${fail} falha(s).`);
if (fail > 0) process.exit(1);
