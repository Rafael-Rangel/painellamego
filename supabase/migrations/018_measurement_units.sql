-- Unidades de medida do catálogo (admin cadastra ao criar produtos; gerentes usam na compra).

create table if not exists public.measurement_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.measurement_units (code, name)
values
  ('un', 'un'),
  ('kg', 'kg'),
  ('g', 'g'),
  ('l', 'L'),
  ('ml', 'ml'),
  ('cx', 'cx'),
  ('pct', 'pct'),
  ('fardo', 'fardo')
on conflict (code) do update set name = excluded.name, is_active = true;

insert into public.measurement_units (code, name)
select distinct lower(trim(standard_unit)), trim(standard_unit)
from public.products
where standard_unit is not null and trim(standard_unit) <> ''
on conflict (code) do update set name = excluded.name, is_active = true;

insert into public.measurement_units (code, name)
select distinct lower(trim(unit_used)), trim(unit_used)
from public.purchase_items
where unit_used is not null and trim(unit_used) <> ''
on conflict (code) do update set name = excluded.name, is_active = true;

alter table public.measurement_units enable row level security;

drop policy if exists measurement_units_read_all on public.measurement_units;
create policy measurement_units_read_all
on public.measurement_units for select
using (true);

drop policy if exists measurement_units_admin_write on public.measurement_units;
create policy measurement_units_admin_write
on public.measurement_units for all
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');
