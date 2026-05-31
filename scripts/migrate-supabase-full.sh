#!/usr/bin/env bash
set -euo pipefail

WORKDIR="${MIGRATE_WORKDIR:-/tmp/lamego-migrate-$$}"
PGIMAGE="${PGIMAGE:-postgres:17-alpine}"
mkdir -p "$WORKDIR"
cp -f "$(dirname "$0")/migrate-supabase-wipe.sql" "$WORKDIR/wipe.sql"

pg() {
  docker run --rm -v "${WORKDIR}:/work" "$PGIMAGE" "$@"
}

pg_replica() {
  docker run --rm -e PGOPTIONS="-c session_replication_role=replica" -v "${WORKDIR}:/work" "$PGIMAGE" "$@"
}

echo "[migrate] workdir=$WORKDIR"

if [[ ! -f "$WORKDIR/public.dump" ]]; then
  echo "[migrate] 1/5 pg_dump public (old)..."
  pg pg_dump "$OLD_DB_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --format=custom \
    --file=/work/public.dump

  echo "[migrate] 2/5 pg_dump auth (old)..."
  pg pg_dump "$OLD_DB_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --table=auth.users \
    --table=auth.identities \
    --format=custom \
    --file=/work/auth.dump

  echo "[migrate] 3/5 pg_dump storage.objects (old)..."
  pg pg_dump "$OLD_DB_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --table=storage.objects \
    --format=custom \
    --file=/work/storage.dump
else
  echo "[migrate] dumps existentes em $WORKDIR (reutilizando)"
fi

echo "[migrate] 4/5 limpando destino (new)..."
pg psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f /work/wipe.sql

echo "[migrate] verificando limpeza..."
pg psql "$NEW_DB_URL" -Atc "select 'stores='||count(*) from public.stores"
pg psql "$NEW_DB_URL" -Atc "select 'categories='||count(*) from public.categories"
pg psql "$NEW_DB_URL" -Atc "select 'auth='||count(*) from auth.users"

echo "[migrate] 5/5 pg_restore no destino (new)..."
pg_replica pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --dbname="$NEW_DB_URL" \
  /work/public.dump

pg_replica pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --dbname="$NEW_DB_URL" \
  /work/auth.dump

pg_replica pg_restore \
  --data-only \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --dbname="$NEW_DB_URL" \
  /work/storage.dump

echo "[migrate] Postgres concluído."
