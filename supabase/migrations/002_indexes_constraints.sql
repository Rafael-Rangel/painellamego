create index if not exists idx_purchase_items_product_date
  on public.purchase_items (product_id, purchase_date desc);

create index if not exists idx_purchase_items_store_date
  on public.purchase_items (store_id, purchase_date desc);

create index if not exists idx_purchase_items_supplier
  on public.purchase_items (supplier_id);

create index if not exists idx_alerts_store_created
  on public.alerts (store_id, created_at desc);

create index if not exists idx_purchases_store_created
  on public.purchases (store_id, created_at desc);

alter table public.purchases
  add constraint unique_invoice_per_store unique (store_id, invoice_number);
