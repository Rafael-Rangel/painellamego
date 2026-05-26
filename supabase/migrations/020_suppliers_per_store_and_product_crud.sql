-- Fornecedores por loja (não globais) e base para CRUD de produtos no admin.

alter table public.suppliers
  add column if not exists store_id uuid references public.stores(id);

-- Remove unicidade global por nome.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'suppliers_name_key'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers drop constraint suppliers_name_key;
  end if;
end $$;

-- Evita duplicidade de fornecedor por loja.
create unique index if not exists suppliers_store_name_unique_idx
  on public.suppliers (store_id, lower(name));

comment on column public.suppliers.store_id is
'Escopo da loja dona do fornecedor. Null em dados legados globais.';
