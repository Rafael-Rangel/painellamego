BEGIN;
SET session_replication_role = replica;

DELETE FROM auth.mfa_amr_claims;
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;
DELETE FROM storage.objects WHERE bucket_id = 'fiscal-receipts';

DO $$
DECLARE
  table_list text;
BEGIN
  SELECT string_agg(format('public.%I', tablename), ', ' ORDER BY tablename)
  INTO table_list
  FROM pg_tables
  WHERE schemaname = 'public';

  EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
END $$;

SET session_replication_role = DEFAULT;
COMMIT;
