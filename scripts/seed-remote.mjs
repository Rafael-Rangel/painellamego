import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env" });

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_PASSWORD"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Variável obrigatória ausente: ${key}`);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
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

async function runMigrations() {
  const migrationsDir = path.resolve("infra/supabase/migrations");
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando migration: ${file}`);
    await client.query(sql);
  }
}

async function getOrCreateUser({ email, password, role, metadata }) {
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  const listData = await listRes.json();
  const existing = (listData.users || []).find((u) => u.email === email);
  if (existing) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_metadata: { ...(existing.app_metadata || {}), role },
        user_metadata: { ...(existing.user_metadata || {}), ...metadata },
        email_confirm: true
      })
    });
    return existing.id;
  }

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: metadata
    })
  });
  const created = await createRes.json();
  return created.id;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

async function seedBusinessData() {
  await client.query(`
    insert into public.stores (id, cnpj, name, location, store_number, manager_name, phone, opening_hours)
    values
      ('11111111-1111-1111-1111-111111111111','11111111000101','Lamego Centro','Centro',1,'Gerente Centro','21999990001','06:00-21:00'),
      ('22222222-2222-2222-2222-222222222222','22222222000102','Lamego Barra','Barra',2,'Gerente Barra','21999990002','06:00-21:00'),
      ('33333333-3333-3333-3333-333333333333','33333333000103','Lamego Tijuca','Tijuca',3,'Gerente Tijuca','21999990003','06:00-21:00'),
      ('44444444-4444-4444-4444-444444444444','44444444000104','Lamego Norte','Zona Norte',4,'Gerente Norte','21999990004','06:00-21:00'),
      ('55555555-5555-5555-5555-555555555555','55555555000105','Lamego Sul','Zona Sul',5,'Gerente Sul','21999990005','06:00-21:00')
    on conflict (id) do update set
      name=excluded.name, location=excluded.location, manager_name=excluded.manager_name, phone=excluded.phone, opening_hours=excluded.opening_hours;
  `);

  await client.query(`
    insert into public.suppliers (name) values
      ('Distribuidora Sul'),
      ('Fornecedor Central'),
      ('Atacado Prime'),
      ('Mercantil Pao Bom'),
      ('Laticinios Rio')
    on conflict (name) do nothing;
  `);

  await client.query(`
    insert into public.products (name, normalized_name, category, type, standard_unit)
    values
      ('Farinha de trigo', 'farinha de trigo', 'Mercearia', 'insumo', 'kg'),
      ('Acucar refinado', 'acucar refinado', 'Mercearia', 'insumo', 'kg'),
      ('Manteiga', 'manteiga', 'Laticinios', 'insumo', 'kg'),
      ('Fermento biologico', 'fermento biologico', 'Padaria', 'insumo', 'kg'),
      ('Leite integral', 'leite integral', 'Laticinios', 'insumo', 'l'),
      ('Cafe moido', 'cafe moido', 'Bebidas', 'venda', 'kg')
    on conflict (normalized_name, category) do nothing;
  `);

  const stores = (await client.query("select id from public.stores order by store_number")).rows;
  const suppliers = (await client.query("select id from public.suppliers")).rows;
  const products = (await client.query("select id, standard_unit from public.products")).rows;

  for (const store of stores) {
    for (let i = 1; i <= 35; i += 1) {
      const invoice = `NF-${store.id.slice(0, 4)}-${String(i).padStart(4, "0")}`;
      const purchaseIdRes = await client.query(
        `
          insert into public.purchases (store_id, invoice_number, created_by, created_at)
          values ($1, $2, $3, now() - ($4 || ' days')::interval)
          on conflict (store_id, invoice_number) do update set invoice_number = excluded.invoice_number
          returning id
        `,
        [store.id, invoice, "00000000-0000-0000-0000-000000000001", Math.floor(randomBetween(1, 170))]
      );
      const purchaseId = purchaseIdRes.rows[0].id;

      const itemCount = Math.floor(randomBetween(2, 5));
      for (let j = 0; j < itemCount; j += 1) {
        const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Number(randomBetween(3, 30).toFixed(2));
        const unitPrice = Number(randomBetween(2.5, 48).toFixed(2));
        const date = new Date(Date.now() - Math.floor(randomBetween(1, 170)) * 24 * 3600 * 1000);
        const week = Math.ceil(date.getDate() / 7);

        await client.query(
          `
            insert into public.purchase_items (
              purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `,
          [purchaseId, store.id, product.id, supplier.id, unitPrice, product.standard_unit || "kg", quantity, date, week]
        );
      }
    }
  }

  // Garante cobertura real: toda loja tem compra de todo produto com data recente.
  for (const store of stores) {
    for (const product of products) {
      const baseInvoice = `BASE-${store.id.slice(0, 4)}-${product.id.slice(0, 4)}`;
      const purchaseRes = await client.query(
        `
          insert into public.purchases (store_id, invoice_number, created_by, created_at)
          values ($1, $2, $3, now() - (($4)::text || ' days')::interval)
          on conflict (store_id, invoice_number) do update set created_at = excluded.created_at
          returning id
        `,
        [store.id, baseInvoice, "00000000-0000-0000-0000-000000000001", Math.floor(randomBetween(1, 25))]
      );
      const purchaseId = purchaseRes.rows[0].id;
      await client.query("delete from public.purchase_items where purchase_id = $1 and product_id = $2", [purchaseId, product.id]);

      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const quantity = Number(randomBetween(5, 25).toFixed(2));
      const unitPrice = Number(randomBetween(3, 45).toFixed(2));
      const date = new Date(Date.now() - Math.floor(randomBetween(1, 25)) * 24 * 3600 * 1000);
      const week = Math.ceil(date.getDate() / 7);
      await client.query(
        `
          insert into public.purchase_items (
            purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [purchaseId, store.id, product.id, supplier.id, unitPrice, product.standard_unit || "kg", quantity, date, week]
      );
    }
  }

  await client.query(`
    insert into public.price_snapshots (product_id, min_price, max_price, avg_price, updated_at)
    select
      product_id,
      min(unit_price),
      max(unit_price),
      avg(unit_price),
      now()
    from public.purchase_items
    group by product_id
    on conflict (product_id) do update set
      min_price = excluded.min_price,
      max_price = excluded.max_price,
      avg_price = excluded.avg_price,
      updated_at = now();
  `);
}

async function seedUsersAndLinks() {
  const stores = (await client.query("select id, name from public.stores order by store_number asc limit 4")).rows;
  const managerDefs = stores.map((store, index) => ({
    email: `gerente.${index + 1}@lamego.local`,
    name: `Gerente ${store.name}`,
    storeId: store.id
  }));

  const adminId = await getOrCreateUser({
    email: "admin@lamego.local",
    password: "Adm!nLamego2026#",
    role: "admin",
    metadata: { display_name: "Administrador Lamego", store_id: null }
  });
  console.log("Admin pronto:", adminId);

  for (const manager of managerDefs) {
    const userId = await getOrCreateUser({
      email: manager.email,
      password: "GerenteLamego2026#",
      role: "manager",
      metadata: { manager_name: manager.name, store_id: manager.storeId, store_ids: [manager.storeId] }
    });
    await client.query("delete from public.manager_store_links where store_id = $1", [manager.storeId]);
    await client.query(
      `
        insert into public.manager_store_links (manager_auth_user_id, store_id)
        values ($1, $2)
        on conflict (store_id) do update set manager_auth_user_id = excluded.manager_auth_user_id
      `,
      [userId, manager.storeId]
    );
    console.log("Gerente pronto:", manager.email, "->", manager.storeId);
  }
}

async function main() {
  const seedOnly = process.argv.includes("--seed-only");
  await client.connect();
  try {
    if (!seedOnly) {
      await runMigrations();
    }
    await seedUsersAndLinks();
    await seedBusinessData();
    console.log("Seed concluído com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Falha no seed remoto:", err);
  process.exit(1);
});
