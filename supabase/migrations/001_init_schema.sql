create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  role text not null check (role in ('manager', 'admin')),
  store_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique not null,
  name text not null,
  location text not null,
  store_number int unique not null,
  manager_name text not null,
  created_at timestamptz not null default now()
);

alter table public.users
  add constraint users_store_fk
  foreign key (store_id) references public.stores(id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  category text not null,
  type text not null check (type in ('insumo', 'venda')),
  standard_unit text not null,
  created_at timestamptz not null default now(),
  unique (normalized_name, category)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  invoice_number text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  supplier_id uuid not null references public.suppliers(id),
  unit_price numeric(12,4) not null check (unit_price > 0),
  unit_used text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  purchase_date date not null,
  week_of_month int not null check (week_of_month between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.fiscal_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.price_snapshots (
  product_id uuid primary key references public.products(id) on delete cascade,
  min_price numeric(12,4) not null,
  max_price numeric(12,4) not null,
  avg_price numeric(12,4) not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  product_id uuid references public.products(id),
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  resource text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
