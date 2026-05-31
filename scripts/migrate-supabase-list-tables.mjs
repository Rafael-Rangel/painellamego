#!/usr/bin/env node
import pg from "pg";

const OLD = {
  ref: "hfxqvitixkrqjggkbbej",
  pwd: "lamegopaninel@123"
};

async function connect(ref, pwd) {
  const client = new pg.Client({
    host: "aws-1-sa-east-1.pooler.supabase.com",
    port: 6543,
    user: `postgres.${ref}`,
    password: pwd,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

const client = await connect(OLD.ref, OLD.pwd);
const { rows } = await client.query(`
  select table_schema, table_name
  from information_schema.tables
  where table_schema in ('public','auth','storage')
    and table_type = 'BASE TABLE'
  order by 1, 2
`);
for (const r of rows) {
  try {
    const c = await client.query(`select count(*)::int as n from ${r.table_schema}.${r.table_name}`);
    if (c.rows[0].n > 0) console.log(`${r.table_schema}.${r.table_name}: ${c.rows[0].n}`);
  } catch (e) {
    console.log(`${r.table_schema}.${r.table_name}: ERR ${e.message.split("\n")[0]}`);
  }
}
await client.end();
