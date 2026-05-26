-- Analytics: preço de venda para margem + view mensal + índice de consulta.

alter table public.products
  add column if not exists sale_price numeric(12, 4);

comment on column public.products.sale_price is 'Preço de venda de referência para cálculo de margem estimada.';

create index if not exists purchase_items_store_product_date_idx
  on public.purchase_items (store_id, product_id, purchase_date desc);

create or replace view public.v_product_monthly_stats as
select
  pi.store_id,
  pi.product_id,
  date_trunc('month', pi.purchase_date)::date as month,
  min(pi.unit_price) as min_price,
  max(pi.unit_price) as max_price,
  (sum(pi.unit_price * pi.quantity) / nullif(sum(pi.quantity), 0))::numeric(12, 4) as avg_price_weighted,
  sum(pi.quantity)::numeric(14, 3) as total_qty,
  sum(pi.unit_price * pi.quantity)::numeric(14, 2) as total_spent
from public.purchase_items pi
where coalesce(pi.is_bonification_only, false) = false
group by pi.store_id, pi.product_id, date_trunc('month', pi.purchase_date)::date;
