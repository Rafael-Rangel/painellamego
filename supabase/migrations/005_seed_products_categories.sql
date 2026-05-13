insert into public.products (name, normalized_name, category, type, standard_unit)
values
  ('Contra Filé', 'contra file', 'Carnes', 'insumo', 'kg'),
  ('Arroz Branco', 'arroz branco', 'Mercearia', 'insumo', 'kg'),
  ('Óleo de Soja', 'oleo de soja', 'Mercearia', 'insumo', 'l')
on conflict (normalized_name, category) do nothing;

insert into public.suppliers (name)
values
  ('Fornecedor Central'),
  ('Distribuidora Sul'),
  ('Atacado Prime')
on conflict (name) do nothing;
