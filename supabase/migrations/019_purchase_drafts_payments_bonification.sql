-- Rascunhos de compra (notebook ↔ celular), parcelas de boleto e bonificação por linha.

create table if not exists public.purchase_drafts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid not null,
  status text not null default 'open' check (status in ('open', 'finalized', 'discarded')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_date date,
  invoice_number text,
  wizard_step int not null default 1 check (wizard_step between 1 and 5),
  items_json jsonb not null default '[]'::jsonb,
  installments_json jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_drafts_store_status_idx
  on public.purchase_drafts (store_id, status, updated_at desc);

create index if not exists purchase_drafts_created_by_idx
  on public.purchase_drafts (created_by, status);

create table if not exists public.purchase_draft_receipts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.purchase_drafts(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists purchase_draft_receipts_draft_idx
  on public.purchase_draft_receipts (draft_id);

alter table public.purchases
  add column if not exists draft_id uuid references public.purchase_drafts(id) on delete set null,
  add column if not exists total_payable numeric(14, 2),
  add column if not exists total_bonus_value numeric(14, 2) not null default 0;

create table if not exists public.purchase_payment_installments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  installment_number int not null check (installment_number >= 1),
  due_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (purchase_id, installment_number)
);

create index if not exists purchase_payment_installments_due_idx
  on public.purchase_payment_installments (store_id, due_date, status);

alter table public.purchase_items
  add column if not exists bonus_quantity numeric(12, 3) not null default 0 check (bonus_quantity >= 0),
  add column if not exists bonus_unit_value numeric(12, 4) not null default 0 check (bonus_unit_value >= 0),
  add column if not exists is_bonification_only boolean not null default false;

comment on table public.purchase_drafts is 'Rascunho de lançamento; permite continuar em outro dispositivo antes de finalizar.';
comment on column public.purchase_items.bonus_quantity is 'Quantidade bonificada (grátis) na mesma linha ou linha só bonificação.';
comment on column public.purchase_items.bonus_unit_value is 'Valor de referência da bonificação para relatórios (R$).';
comment on column public.purchase_items.is_bonification_only is 'Linha 100% bonificação: quantity/unit_price podem ser 0; bonus_quantity > 0.';

create or replace view public.v_monthly_bonification as
select
  pi.store_id,
  s.name as store_name,
  date_trunc('month', pi.purchase_date)::date as month_start,
  pi.product_id,
  p.name as product_name,
  p.category,
  sum(pi.bonus_quantity)::numeric(14, 3) as total_bonus_qty,
  sum(pi.bonus_quantity * pi.bonus_unit_value)::numeric(14, 2) as total_bonus_value
from public.purchase_items pi
join public.stores s on s.id = pi.store_id
join public.products p on p.id = pi.product_id
where pi.bonus_quantity > 0 or pi.is_bonification_only
group by pi.store_id, s.name, date_trunc('month', pi.purchase_date), pi.product_id, p.name, p.category;

grant select on public.v_monthly_bonification to authenticated;
