-- Wipe operacional (public): compras, catálogo, lojas, links gerente, audit, public.users.
-- Mantém public.categories (taxonomia).
-- Para também remover utilizadores Auth exceto admin@lamego.local e limpar Storage, use:
--   npm run db:wipe-remote
-- (o SQL direto em tabelas auth.* varia entre versões do Supabase; o script usa a Admin API.)

BEGIN;

DELETE FROM public.fiscal_receipts;
DELETE FROM public.purchase_items;
DELETE FROM public.purchases;
DELETE FROM public.alerts;
DELETE FROM public.price_snapshots;
DELETE FROM public.manager_store_links;
DELETE FROM public.audit_logs;
DELETE FROM public.suppliers;
DELETE FROM public.products;
DELETE FROM public.stores;
DELETE FROM public.users;

COMMIT;
