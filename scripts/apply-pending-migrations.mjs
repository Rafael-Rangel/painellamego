#!/usr/bin/env node
/**
 * Aplica migrations locais ainda não registadas em supabase_migrations.schema_migrations.
 * Usa SUPABASE_URL + SUPABASE_DB_PASSWORD no .env da raiz (ou .env.production).
 *
 * Uso: node scripts/apply-pending-migrations.mjs
 *      DOTENV_CONFIG_PATH=.env.production node scripts/apply-pending-migrations.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.join(root, ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !dbPassword) {
  console.error("[migrations] Faltam SUPABASE_URL ou SUPABASE_DB_PASSWORD no .env.");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const migrationsDir = path.join(root, "supabase/migrations");

const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

function versionFromFilename(name) {
  const m = name.match(/^(\d+)_/);
  return m ? m[1] : null;
}

await client.connect();
try {
  const { rows } = await client.query("SELECT version FROM supabase_migrations.schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql") && !f.includes("wipe"))
    .sort((a, b) => a.localeCompare(b));

  let ran = 0;
  for (const file of files) {
    const version = versionFromFilename(file);
    if (!version || applied.has(version)) continue;

    const sqlPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(sqlPath, "utf8");
    console.log(`[migrations] A aplicar ${file} (v${version})…`);
    await client.query(sql);
    await client.query("INSERT INTO supabase_migrations.schema_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING", [
      version
    ]);
    applied.add(version);
    ran += 1;
    console.log(`[migrations] OK ${file}`);
  }

  if (!ran) console.log("[migrations] Nada pendente; remoto já está em dia.");
  else console.log(`[migrations] ${ran} migration(s) aplicada(s).`);
} finally {
  await client.end();
}
