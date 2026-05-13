create table if not exists public.manager_store_links (
  manager_auth_user_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (manager_auth_user_id, store_id),
  unique (store_id)
);

alter table public.stores
  add column if not exists phone text,
  add column if not exists opening_hours text,
  add column if not exists onboarding_notes text;

alter table public.manager_store_links enable row level security;

drop policy if exists manager_store_links_admin_read on public.manager_store_links;
create policy manager_store_links_admin_read
on public.manager_store_links for select
using (public.current_role() = 'admin');

drop policy if exists manager_store_links_admin_write on public.manager_store_links;
create policy manager_store_links_admin_write
on public.manager_store_links for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');
