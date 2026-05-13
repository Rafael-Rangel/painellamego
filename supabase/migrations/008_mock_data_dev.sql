insert into public.stores (id, cnpj, name, location, store_number, manager_name)
values
  ('11111111-1111-1111-1111-111111111111', '00000000000191', 'Padaria Centro', 'Centro', 1, 'Gerente Centro'),
  ('22222222-2222-2222-2222-222222222222', '00000000000272', 'Padaria Sul', 'Zona Sul', 2, 'Gerente Sul'),
  ('33333333-3333-3333-3333-333333333333', '00000000000353', 'Padaria Norte', 'Zona Norte', 3, 'Gerente Norte')
on conflict (id) do nothing;

insert into public.purchases (id, store_id, invoice_number, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'NF-1001', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'NF-1002', '00000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '33333333-3333-3333-3333-333333333333', 'NF-1003', '00000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '11111111-1111-1111-1111-111111111111',
  p.id,
  s.id,
  34.90,
  'kg',
  10,
  current_date - 2,
  public.fn_week_of_month(current_date - 2)
from public.products p
cross join public.suppliers s
where p.normalized_name = 'contra file'
limit 1
on conflict do nothing;

insert into public.purchase_items (
  purchase_id, store_id, product_id, supplier_id, unit_price, unit_used, quantity, purchase_date, week_of_month
)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  '22222222-2222-2222-2222-222222222222',
  p.id,
  s.id,
  39.40,
  'kg',
  8,
  current_date - 1,
  public.fn_week_of_month(current_date - 1)
from public.products p
cross join public.suppliers s
where p.normalized_name = 'contra file'
limit 1
on conflict do nothing;
