create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.categories (code, name)
values
  ('carnes', 'Carnes'),
  ('mercearia', 'Mercearia'),
  ('higiene', 'Higiene')
on conflict (code) do nothing;

alter table public.products
  add column if not exists category_id uuid references public.categories(id),
  add column if not exists is_active boolean not null default true;

update public.products p
set category_id = c.id
from public.categories c
where lower(p.category) = lower(c.name)
  and p.category_id is null;

create index if not exists idx_products_category_id on public.products (category_id);
create index if not exists idx_products_is_active on public.products (is_active);
