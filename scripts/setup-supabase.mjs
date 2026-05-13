#!/usr/bin/env node
/**
 * Bootstrap idempotente do Supabase:
 *  - Cria/atualiza o usuário admin (admin@lamego.local)
 *  - Cria/atualiza 3 gerentes ligados às lojas Centro/Sul/Norte
 *  - Garante linhas em public.manager_store_links
 *
 * Pré-requisitos:
 *  - .env (na raiz) com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY válidos do projeto novo
 *  - Tabela public.stores já populada (vem da migration 008_mock_data_dev.sql)
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

const MANAGER_USERS = [
  {
    email: "gerente.centro@lamego.com.br",
    password: "Gerente@2026!",
    storeNumber: 1,
    managerName: "Gerente Centro"
  },
  {
    email: "gerente.sul@lamego.com.br",
    password: "Gerente@2026!",
    storeNumber: 2,
    managerName: "Gerente Sul"
  },
  {
    email: "gerente.norte@lamego.com.br",
    password: "Gerente@2026!",
    storeNumber: 3,
    managerName: "Gerente Norte"
  }
];

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

async function getStoreByNumber(storeNumber) {
  const { data, error } = await admin
    .from("stores")
    .select("id, name, store_number")
    .eq("store_number", storeNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureManagerStoreLink(managerId, storeId) {
  const { error } = await admin
    .from("manager_store_links")
    .upsert(
      { manager_auth_user_id: managerId, store_id: storeId },
      { onConflict: "manager_auth_user_id,store_id" }
    );
  if (error) throw error;
}

async function run() {
  console.log(`[bootstrap] Conectando em ${SUPABASE_URL}`);

  await upsertUser(ADMIN_USER);

  for (const m of MANAGER_USERS) {
    const store = await getStoreByNumber(m.storeNumber);
    if (!store) {
      console.warn(
        `[bootstrap] Loja com store_number=${m.storeNumber} não encontrada. ` +
          `Confirme que a migration 008_mock_data_dev.sql foi aplicada.`
      );
      continue;
    }
    const user = await upsertUser({
      email: m.email,
      password: m.password,
      app_metadata: { role: "manager" },
      user_metadata: {
        store_id: store.id,
        store_number: store.store_number,
        manager_name: m.managerName
      }
    });
    await ensureManagerStoreLink(user.id, store.id);
    console.log(`[bootstrap] Link gerente-loja garantido: ${m.email} -> ${store.name}`);
  }

  console.log("\n[bootstrap] Concluído. Credenciais default:");
  console.log(`  ADMIN    -> ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
  for (const m of MANAGER_USERS) {
    console.log(`  GERENTE  -> ${m.email} / ${m.password}`);
  }
  console.log(
    "\nLembre-se de trocar essas senhas pelo Dashboard do Supabase em produção."
  );
}

run().catch((err) => {
  console.error("[bootstrap] ERRO:", err.message || err);
  process.exit(1);
});
