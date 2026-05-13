alter table public.categories enable row level security;

drop policy if exists categories_read_all on public.categories;
create policy categories_read_all
on public.categories for select
using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write
on public.categories for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin
on public.products for insert
with check (public.current_role() = 'admin');

drop policy if exists products_update_admin on public.products;
create policy products_update_admin
on public.products for update
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin
on public.products for delete
using (public.current_role() = 'admin');

drop policy if exists stores_insert_admin on public.stores;
create policy stores_insert_admin
on public.stores for insert
with check (public.current_role() = 'admin');

drop policy if exists stores_update_admin on public.stores;
create policy stores_update_admin
on public.stores for update
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists stores_delete_admin on public.stores;
create policy stores_delete_admin
on public.stores for delete
using (public.current_role() = 'admin');

create or replace view public.v_store_product_price_stats as
select
  pi.store_id,
  s.name as store_name,
  pi.product_id,
  p.name as product_name,
  min(pi.unit_price) as min_price,
  max(pi.unit_price) as max_price,
  avg(pi.unit_price)::numeric(12,4) as avg_price,
  max(pi.purchase_date) as last_purchase_at
from public.purchase_items pi
join public.stores s on s.id = pi.store_id
join public.products p on p.id = pi.product_id
group by pi.store_id, s.name, pi.product_id, p.name;

create or replace view public.v_admin_price_opportunities as
select
  sp.store_id,
  sp.store_name,
  sp.product_id,
  sp.product_name,
  sp.avg_price as store_avg_price,
  ps.min_price as network_min_price,
  ps.avg_price as network_avg_price,
  case
    when ps.min_price > 0 then round(((sp.avg_price - ps.min_price) / ps.min_price) * 100, 2)
    else 0
  end as above_best_percent
from public.v_store_product_price_stats sp
join public.price_snapshots ps on ps.product_id = sp.product_id;

grant select on public.v_store_product_price_stats to authenticated;
grant select on public.v_admin_price_opportunities to authenticated;
