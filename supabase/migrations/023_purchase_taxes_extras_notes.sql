-- Impostos, extras e observações no registro manual de compras.

alter table public.purchase_drafts
  add column if not exists taxes_json jsonb not null default '[]'::jsonb,
  add column if not exists extras_json jsonb not null default '[]'::jsonb;

alter table public.purchase_drafts
  drop constraint if exists purchase_drafts_wizard_step_check;

alter table public.purchase_drafts
  add constraint purchase_drafts_wizard_step_check
  check (wizard_step between 1 and 6);

alter table public.purchases
  add column if not exists taxes_json jsonb not null default '[]'::jsonb,
  add column if not exists extras_json jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists total_taxes numeric(14, 2) not null default 0,
  add column if not exists total_extras numeric(14, 2) not null default 0,
  add column if not exists grand_total numeric(14, 2);

comment on column public.purchase_drafts.taxes_json is 'Lista de impostos opcionais [{name, amount}] no rascunho.';
comment on column public.purchase_drafts.extras_json is 'Lista de extras opcionais [{name, amount}] no rascunho.';
comment on column public.purchases.grand_total is 'Total da nota = produtos pagos + impostos + extras.';
