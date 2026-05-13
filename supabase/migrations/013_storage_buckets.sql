-- Bucket privado para arquivos de notas fiscais enviadas pelo gerente.
-- Idempotente: pode ser aplicado em qualquer ambiente.

insert into storage.buckets (id, name, public)
values ('fiscal-receipts', 'fiscal-receipts', false)
on conflict (id) do nothing;

-- A API do Lamego usa SERVICE_ROLE e ignora RLS na hora do upload/download.
-- Mesmo assim deixamos policies coerentes para clientes autenticados que
-- futuramente usarem o cliente JS direto. Removemos antes para evitar
-- duplicidade quando reaplicar.

drop policy if exists "fiscal_receipts_admin_select" on storage.objects;
drop policy if exists "fiscal_receipts_admin_insert" on storage.objects;
drop policy if exists "fiscal_receipts_admin_update" on storage.objects;
drop policy if exists "fiscal_receipts_admin_delete" on storage.objects;

create policy "fiscal_receipts_admin_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'fiscal-receipts');

create policy "fiscal_receipts_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'fiscal-receipts');

create policy "fiscal_receipts_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'fiscal-receipts')
  with check (bucket_id = 'fiscal-receipts');

create policy "fiscal_receipts_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'fiscal-receipts');
