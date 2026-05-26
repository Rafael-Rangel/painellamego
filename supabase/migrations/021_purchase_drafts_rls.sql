-- RLS em purchase_drafts: leitura podia devolver vazio; INSERT falhava na API.
-- Políticas alinhadas a purchases + service_role (JWT da chave da API).

alter table public.purchase_drafts enable row level security;
alter table public.purchase_draft_receipts enable row level security;

drop policy if exists purchase_drafts_rw_scoped on public.purchase_drafts;
create policy purchase_drafts_rw_scoped
on public.purchase_drafts
for all
using (
  coalesce(auth.jwt() ->> 'role', '') in ('service_role', 'supabase_admin')
  or public.current_role() = 'admin'
  or store_id = public.current_store_id()
)
with check (
  coalesce(auth.jwt() ->> 'role', '') in ('service_role', 'supabase_admin')
  or public.current_role() = 'admin'
  or store_id = public.current_store_id()
);

drop policy if exists purchase_draft_receipts_rw_scoped on public.purchase_draft_receipts;
create policy purchase_draft_receipts_rw_scoped
on public.purchase_draft_receipts
for all
using (
  coalesce(auth.jwt() ->> 'role', '') in ('service_role', 'supabase_admin')
  or public.current_role() = 'admin'
  or exists (
    select 1
    from public.purchase_drafts d
    where d.id = purchase_draft_receipts.draft_id
      and d.store_id = public.current_store_id()
  )
)
with check (
  coalesce(auth.jwt() ->> 'role', '') in ('service_role', 'supabase_admin')
  or public.current_role() = 'admin'
  or exists (
    select 1
    from public.purchase_drafts d
    where d.id = purchase_draft_receipts.draft_id
      and d.store_id = public.current_store_id()
  )
);
