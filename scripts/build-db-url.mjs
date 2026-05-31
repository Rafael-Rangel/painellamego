import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env");
const text = fs.readFileSync(envFile, "utf8");

function readEnv(key) {
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const password = encodeURIComponent(readEnv("SUPABASE_DB_PASSWORD"));
const ref = readEnv("SUPABASE_PROJECT_REF");
if (!password || !ref) {
  console.error("Falta SUPABASE_DB_PASSWORD ou SUPABASE_PROJECT_REF em .env");
  process.exit(1);
}
process.stdout.write(`postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`);
