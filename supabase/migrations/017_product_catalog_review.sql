-- Revisão de catálogo (produtos criados pela IA) e sinónimos globais para merge.

alter table public.products
  add column if not exists needs_catalog_review boolean not null default false;

alter table public.products
  drop constraint if exists products_created_by_check;

alter table public.products
  add constraint products_created_by_check
  check (created_by in ('admin', 'manager', 'ai_auto'));

create index if not exists idx_products_needs_catalog_review
  on public.products (needs_catalog_review)
  where needs_catalog_review = true;

create index if not exists idx_products_created_by_ai
  on public.products (created_by)
  where created_by = 'ai_auto';

create table if not exists public.product_canonical_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_product_id uuid not null references public.products(id) on delete cascade,
  normalized_key text not null,
  label_raw text,
  source text not null default 'merge' check (source in ('merge', 'admin', 'ai_auto')),
  created_at timestamptz not null default now(),
  unique (normalized_key)
);

create index if not exists idx_product_canonical_aliases_canonical
  on public.product_canonical_aliases (canonical_product_id);

alter table public.product_canonical_aliases enable row level security;

-- Leitura para utilizadores autenticados via PostgREST (se usado); API usa service role.
create policy product_canonical_aliases_read_all
  on public.product_canonical_aliases for select
  to authenticated
  using (true);

create policy product_canonical_aliases_write_admin
  on public.product_canonical_aliases for all
  to authenticated
  using (
    exists (select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from public.users u where u.auth_user_id = auth.uid() and u.role = 'admin')
  );
