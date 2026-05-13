-- Extensão para fuzzy match localizado (opcional; usada por queries futuras / índice).
create extension if not exists pg_trgm;

-- Mapeamento texto normalizado (por fornecedor) → produto canónico global.
create table if not exists public.supplier_product_aliases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  label_normalized text not null,
  label_raw text,
  product_id uuid not null references public.products(id) on delete cascade,
  source text not null default 'admin' check (source in ('admin', 'manager', 'auto_high', 'auto_pending')),
  confidence numeric(6, 4),
  use_count int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, label_normalized)
);

create index if not exists idx_supplier_product_aliases_supplier
  on public.supplier_product_aliases (supplier_id);

create index if not exists idx_supplier_product_aliases_product
  on public.supplier_product_aliases (product_id);

-- Suporte a busca por similaridade (prefixo / typos) sem full-scan em toda a rede.
create index if not exists idx_supplier_product_aliases_label_trgm
  on public.supplier_product_aliases using gin (label_normalized gin_trgm_ops);

alter table public.supplier_product_aliases enable row level security;

drop policy if exists supplier_product_aliases_admin_all on public.supplier_product_aliases;
create policy supplier_product_aliases_admin_all
  on public.supplier_product_aliases for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');
