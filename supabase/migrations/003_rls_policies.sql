alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.fiscal_receipts enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role')::text, 'manager');
$$;

create or replace function public.current_store_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'store_id', '')::uuid;
$$;

create policy stores_select
on public.stores for select
using (public.current_role() = 'admin' or id = public.current_store_id());

create policy products_read_all
on public.products for select
using (true);

create policy suppliers_read_all
on public.suppliers for select
using (true);

create policy suppliers_insert_admin_or_manager
on public.suppliers for insert
with check (public.current_role() in ('admin', 'manager'));

create policy purchases_rw_scoped
on public.purchases for all
using (public.current_role() = 'admin' or store_id = public.current_store_id())
with check (public.current_role() = 'admin' or store_id = public.current_store_id());

create policy purchase_items_rw_scoped
on public.purchase_items for all
using (public.current_role() = 'admin' or store_id = public.current_store_id())
with check (public.current_role() = 'admin' or store_id = public.current_store_id());

create policy alerts_read_scoped
on public.alerts for select
using (public.current_role() = 'admin' or store_id = public.current_store_id());

create policy alerts_insert_service_or_admin
on public.alerts for insert
with check (public.current_role() = 'admin' or public.current_role() = 'service_role');

create policy snapshots_read_all
on public.price_snapshots for select
using (true);

create policy audit_logs_admin_read
on public.audit_logs for select
using (public.current_role() = 'admin');

create policy audit_logs_insert_any_auth
on public.audit_logs for insert
with check (auth.uid() is not null or public.current_role() = 'service_role');

create policy fiscal_receipts_rw_scoped
on public.fiscal_receipts for all
using (
  exists (
    select 1
    from public.purchases p
    where p.id = fiscal_receipts.purchase_id
      and (public.current_role() = 'admin' or p.store_id = public.current_store_id())
  )
)
with check (
  exists (
    select 1
    from public.purchases p
    where p.id = fiscal_receipts.purchase_id
      and (public.current_role() = 'admin' or p.store_id = public.current_store_id())
  )
);
