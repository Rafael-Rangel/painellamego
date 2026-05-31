#!/usr/bin/env node
import pg from "pg";

const targets = [
  { label: "old", ref: "hfxqvitixkrqjggkbbej", pwd: "lamegopaninel@123" },
  { label: "new", ref: "frgrifwvgujyxoulgfnz", pwd: "Rr@0924660102#" }
];

async function connect(ref, pwd) {
  const prefixes = ["aws-0", "aws-1"];
  const regions = ["sa-east-1", "us-east-1", "us-east-2"];
  for (const p of prefixes) {
    for (const r of regions) {
      const host = `${p}-${r}.pooler.supabase.com`;
      const client = new pg.Client({
        host,
        port: 6543,
        user: `postgres.${ref}`,
        password: pwd,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000
      });
      try {
        await client.connect();
        return { client, host };
      } catch {
        try {
          await client.end();
        } catch {}
      }
    }
  }
  throw new Error(`no pooler for ${ref}`);
}

for (const t of targets) {
  const { client, host } = await connect(t.ref, t.pwd);
  console.log(`\n=== ${t.label} (${host}) ===`);
  const tables = [
    "purchases",
    "purchase_items",
    "fiscal_receipts",
    "stores",
    "products",
    "suppliers",
    "purchase_drafts"
  ];
  for (const table of tables) {
    const { rows } = await client.query(`select count(*)::int as n from public.${table}`);
    console.log(`${table}: ${rows[0].n}`);
  }
  const auth = await client.query("select count(*)::int as n from auth.users");
  console.log(`auth.users: ${auth.rows[0].n}`);
  const objs = await client.query(
    "select count(*)::int as n from storage.objects where bucket_id = 'fiscal-receipts'"
  );
  console.log(`storage.objects (fiscal-receipts): ${objs.rows[0].n}`);
  const mig = await client.query(
    "select version from supabase_migrations.schema_migrations order by version"
  );
  console.log(`migrations: ${mig.rows.map((r) => r.version).join(", ")}`);
  await client.end();
}
