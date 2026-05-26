-- Dados adicionais para dashboard do gerente: itens na compra da loja 3, compras com histórico e notas fiscais simuladas.

-- Compra aaa3 existia sem itens; preenche com mix de produtos
insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  '33333333-3333-3333-3333-333333333333',
  p.id,
  s.id,
  42.00,
  'kg',
  6,
  current_date - 5,
  public.fn_week_of_month(current_date - 5)
from public.products p
cross join public.suppliers s
where p.normalized_name = 'contra file'
  and s.name = 'Distribuidora Sul'
  and not exists (
    select 1 from public.purchase_items pi
    where pi.purchase_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and pi.product_id = p.id
  )
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  '33333333-3333-3333-3333-333333333333',
  p.id,
  s.id,
  5.80,
  'kg',
  40,
  current_date - 5,
  public.fn_week_of_month(current_date - 5)
from public.products p
cross join public.suppliers s
where p.normalized_name = 'arroz branco'
  and s.name = 'Atacado Prime'
  and not exists (
    select 1 from public.purchase_items pi
    where pi.purchase_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and pi.product_id = p.id
  )
limit 1;

-- Novas compras por loja (histórico ~90 dias)
insert into public.purchases (id, store_id, invoice_number, created_by, created_at)
values
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'NF-C201', '00000000-0000-0000-0000-000000000001', current_timestamp - interval '88 days'),
  ('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'NF-C202', '00000000-0000-0000-0000-000000000001', current_timestamp - interval '62 days'),
  ('c0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'NF-C203', '00000000-0000-0000-0000-000000000001', current_timestamp - interval '35 days'),
  ('c0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'NF-C204', '00000000-0000-0000-0000-000000000001', current_timestamp - interval '12 days'),
  ('c0000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'NF-S201', '00000000-0000-0000-0000-000000000002', current_timestamp - interval '75 days'),
  ('c0000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'NF-S202', '00000000-0000-0000-0000-000000000002', current_timestamp - interval '48 days'),
  ('c0000007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'NF-S203', '00000000-0000-0000-0000-000000000002', current_timestamp - interval '20 days'),
  ('c0000008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'NF-N201', '00000000-0000-0000-0000-000000000003', current_timestamp - interval '55 days'),
  ('c0000009-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 'NF-N202', '00000000-0000-0000-0000-000000000003', current_timestamp - interval '8 days')
on conflict (id) do nothing;

-- Itens por compra (valores realistas)
insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', p.id, s.id, 32.00, 'kg', 15,
  (current_date - 88)::date, public.fn_week_of_month((current_date - 88)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', p.id, s.id, 4.20, 'kg', 50,
  (current_date - 88)::date, public.fn_week_of_month((current_date - 88)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', p.id, s.id, 6.10, 'l', 24,
  (current_date - 62)::date, public.fn_week_of_month((current_date - 62)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'oleo de soja' and s.name = 'Atacado Prime'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', p.id, s.id, 35.50, 'kg', 12,
  (current_date - 35)::date, public.fn_week_of_month((current_date - 35)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', p.id, s.id, 5.50, 'kg', 30,
  (current_date - 35)::date, public.fn_week_of_month((current_date - 35)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', p.id, s.id, 33.90, 'kg', 20,
  (current_date - 12)::date, public.fn_week_of_month((current_date - 12)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Atacado Prime'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', p.id, s.id, 5.95, 'kg', 45,
  (current_date - 12)::date, public.fn_week_of_month((current_date - 12)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', p.id, s.id, 6.30, 'l', 18,
  (current_date - 12)::date, public.fn_week_of_month((current_date - 12)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'oleo de soja' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', p.id, s.id, 38.00, 'kg', 10,
  (current_date - 75)::date, public.fn_week_of_month((current_date - 75)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', p.id, s.id, 4.80, 'kg', 60,
  (current_date - 75)::date, public.fn_week_of_month((current_date - 75)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Atacado Prime'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', p.id, s.id, 36.20, 'kg', 14,
  (current_date - 48)::date, public.fn_week_of_month((current_date - 48)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', p.id, s.id, 6.00, 'l', 20,
  (current_date - 48)::date, public.fn_week_of_month((current_date - 48)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'oleo de soja' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', p.id, s.id, 34.50, 'kg', 18,
  (current_date - 20)::date, public.fn_week_of_month((current_date - 20)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Atacado Prime'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', p.id, s.id, 5.20, 'kg', 40,
  (current_date - 20)::date, public.fn_week_of_month((current_date - 20)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', p.id, s.id, 40.00, 'kg', 8,
  (current_date - 55)::date, public.fn_week_of_month((current_date - 55)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Distribuidora Sul'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', p.id, s.id, 5.70, 'kg', 35,
  (current_date - 55)::date, public.fn_week_of_month((current_date - 55)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'arroz branco' and s.name = 'Atacado Prime'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000009-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', p.id, s.id, 37.80, 'kg', 11,
  (current_date - 8)::date, public.fn_week_of_month((current_date - 8)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'contra file' and s.name = 'Fornecedor Central'
limit 1;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select 'c0000009-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', p.id, s.id, 6.15, 'l', 22,
  (current_date - 8)::date, public.fn_week_of_month((current_date - 8)::date)
from public.products p, public.suppliers s
where p.normalized_name = 'oleo de soja' and s.name = 'Distribuidora Sul'
limit 1;

-- Notas fiscais anexadas (metadados apenas; bucket real é opcional)
insert into public.fiscal_receipts (purchase_id, storage_path, original_name, mime_type)
select 'c0000001-0000-0000-0000-000000000001', 'seed/nf-c201.pdf', 'NF-C201.pdf', 'application/pdf'
where not exists (select 1 from public.fiscal_receipts fr where fr.purchase_id = 'c0000001-0000-0000-0000-000000000001');

insert into public.fiscal_receipts (purchase_id, storage_path, original_name, mime_type)
select 'c0000004-0000-0000-0000-000000000004', 'seed/nf-c204.pdf', 'NF-C204.pdf', 'application/pdf'
where not exists (select 1 from public.fiscal_receipts fr where fr.purchase_id = 'c0000004-0000-0000-0000-000000000004');

insert into public.fiscal_receipts (purchase_id, storage_path, original_name, mime_type)
select 'c0000006-0000-0000-0000-000000000006', 'seed/nf-s202.pdf', 'NF-S202.pdf', 'application/pdf'
where not exists (select 1 from public.fiscal_receipts fr where fr.purchase_id = 'c0000006-0000-0000-0000-000000000006');

insert into public.fiscal_receipts (purchase_id, storage_path, original_name, mime_type)
select 'c0000009-0000-0000-0000-000000000009', 'seed/nf-n202.pdf', 'NF-N202.pdf', 'application/pdf'
where not exists (select 1 from public.fiscal_receipts fr where fr.purchase_id = 'c0000009-0000-0000-0000-000000000009');

insert into public.fiscal_receipts (purchase_id, storage_path, original_name, mime_type)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'seed/nf-1001.pdf', 'NF-1001.pdf', 'application/pdf'
where not exists (select 1 from public.fiscal_receipts fr where fr.purchase_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1');
