-- Classificação por linha de nota: insumo (uso interno) ou venda (revenda).
alter table public.purchase_items
  add column line_type text not null default 'insumo'
  constraint purchase_items_line_type_check check (line_type in ('insumo', 'venda'));

comment on column public.purchase_items.line_type is 'Classificação do lançamento na nota: insumo ou venda.';
