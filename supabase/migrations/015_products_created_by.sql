-- Origem do cadastro: admin (painel) vs manager (criação rápida na compra).
alter table public.products
  add column if not exists created_by text not null default 'admin';

alter table public.products
  drop constraint if exists products_created_by_check;

alter table public.products
  add constraint products_created_by_check
  check (created_by in ('admin', 'manager'));

update public.products set created_by = 'admin' where created_by is null;

create index if not exists idx_products_created_by on public.products (created_by);
