create or replace function public.fn_week_of_month(p_date date)
returns int
language sql
immutable
as $$
  select ceil(extract(day from p_date) / 7.0)::int;
$$;

create or replace view public.v_product_store_prices as
select
  pi.product_id,
  p.name as product_name,
  pi.store_id,
  s.name as store_name,
  min(pi.unit_price) as unit_price,
  max(pi.purchase_date) as last_purchase_at
from public.purchase_items pi
join public.products p on p.id = pi.product_id
join public.stores s on s.id = pi.store_id
group by pi.product_id, p.name, pi.store_id, s.name;

create or replace view public.v_product_price_stats as
select
  pi.product_id,
  p.name as product_name,
  min(pi.unit_price) as min_price,
  max(pi.unit_price) as max_price,
  avg(pi.unit_price)::numeric(12,4) as avg_price,
  max(pi.purchase_date) as last_purchase_at
from public.purchase_items pi
join public.products p on p.id = pi.product_id
group by pi.product_id, p.name;

create or replace view public.v_store_efficiency_ranking as
select
  pi.store_id,
  s.name as store_name,
  (
    100 -
    coalesce(
      avg(
        case
          when ps.avg_price > 0 then ((pi.unit_price - ps.avg_price) / ps.avg_price) * 100
          else 0
        end
      ),
      0
    )
  )::numeric(10,2) as efficiency_score
from public.purchase_items pi
join public.stores s on s.id = pi.store_id
left join public.price_snapshots ps on ps.product_id = pi.product_id
group by pi.store_id, s.name;

create or replace function public.fn_period_summary(p_months int default 6)
returns table (
  store_id uuid,
  store_name text,
  supplier_name text,
  total_spent numeric
)
language sql
stable
as $$
  select
    s.id as store_id,
    s.name as store_name,
    sp.name as supplier_name,
    sum(pi.quantity * pi.unit_price)::numeric(14,2) as total_spent
  from public.purchase_items pi
  join public.stores s on s.id = pi.store_id
  join public.suppliers sp on sp.id = pi.supplier_id
  where pi.purchase_date >= current_date - make_interval(months => p_months)
  group by s.id, s.name, sp.name
  order by total_spent desc;
$$;

create policy products_insert_admin
on public.products for insert
with check (public.current_role() = 'admin');
