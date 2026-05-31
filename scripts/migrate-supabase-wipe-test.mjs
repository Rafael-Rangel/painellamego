#!/usr/bin/env node
import pg from "pg";

const NEW_URL =
  "postgresql://postgres.frgrifwvgujyxoulgfnz:Rr%400924660102%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

const client = new pg.Client({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const before = async () => {
  const q = await client.query(`
    select
      (select count(*)::int from public.stores) as stores,
      (select count(*)::int from public.categories) as categories,
      (select count(*)::int from auth.users) as auth
  `);
  return q.rows[0];
};

console.log("before", await before());

await client.query("BEGIN");
await client.query("SET session_replication_role = replica");
await client.query("DELETE FROM auth.mfa_amr_claims");
await client.query("DELETE FROM auth.sessions");
await client.query("DELETE FROM auth.refresh_tokens");
await client.query("DELETE FROM auth.identities");
await client.query("DELETE FROM auth.users");
await client.query("DELETE FROM storage.objects WHERE bucket_id = 'fiscal-receipts'");

const { rows: tables } = await client.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
);
const list = tables.map((r) => `public.${r.tablename}`).join(", ");
await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
await client.query("SET session_replication_role = DEFAULT");
await client.query("COMMIT");

console.log("after", await before());
await client.end();
