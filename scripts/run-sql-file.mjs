#!/usr/bin/env node
/**
 * Executa um ficheiro .sql contra o Postgres do Supabase (usa SUPABASE_DB_PASSWORD no .env).
 * Uso: node scripts/run-sql-file.mjs ops/sql/wipe-database-admin-only.sql
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const sqlPathArg = process.argv[2];
if (!sqlPathArg) {
  console.error("Uso: node scripts/run-sql-file.mjs <caminho-para-ficheiro.sql>");
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlPathArg) ? sqlPathArg : path.resolve(process.cwd(), sqlPathArg);

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !dbPassword) {
  console.error("Faltam SUPABASE_URL ou SUPABASE_DB_PASSWORD no .env da raiz.");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const dbHost = `db.${projectRef}.supabase.co`;

const client = new Client({
  host: dbHost,
  port: 5432,
  user: "postgres",
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

const sql = await fs.readFile(sqlPath, "utf8");
console.log(`[run-sql-file] A executar: ${sqlPath}`);
await client.connect();
try {
  await client.query(sql);
  console.log("[run-sql-file] Concluído sem erros.");
} finally {
  await client.end();
}
