#!/usr/bin/env node
/**
 * Bootstrap idempotente do Supabase:
 *  - Cria/atualiza apenas o utilizador admin (admin@lamego.local)
 *
 * Pré-requisitos:
 *  - .env (na raiz) com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY válidos
 *
 * Uso: npm run supabase:bootstrap
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({ path: path.resolve(__dirname, "../apps/api/.env"), override: false });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("[bootstrap] Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ADMIN_USER = {
  email: "admin@lamego.local",
  password: "Adm!nLamego2026#",
  app_metadata: { role: "admin" },
  user_metadata: { display_name: "Admin Lamego" }
};

async function findUserByEmail(email) {
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data?.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data?.users || data.users.length < perPage) return null;
  }
  return null;
}

async function upsertUser({ email, password, app_metadata, user_metadata }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata,
      user_metadata
    });
    if (error) throw error;
    console.log(`[bootstrap] Atualizado: ${email}`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata,
    user_metadata
  });
  if (error) throw error;
  console.log(`[bootstrap] Criado: ${email}`);
  return data.user;
}

async function run() {
  console.log(`[bootstrap] Conectando em ${SUPABASE_URL}`);

  await upsertUser(ADMIN_USER);

  console.log("\n[bootstrap] Concluído. Credencial default:");
  console.log(`  ADMIN -> ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
  console.log("\nConvites de gerentes são feitos pelo painel admin (Convidar gerente).");
  console.log("Troque a senha pelo Dashboard do Supabase em produção.");
}

run().catch((err) => {
  console.error("[bootstrap] ERRO:", err.message || err);
  process.exit(1);
});
