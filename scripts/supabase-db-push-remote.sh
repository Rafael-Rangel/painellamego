#!/usr/bin/env bash
# Aplica migrations pendentes no Supabase remoto via CLI (sem supabase link).
# Requer no .env ou .env.production: SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=scripts/supabase-env.sh
source "$ROOT/scripts/supabase-env.sh"

cd "$ROOT"
echo "[db:push:remote] Supabase CLI db push → db.${SUPABASE_PROJECT_REF}.supabase.co"
npx supabase db push --db-url "$DB_URL" --yes "$@"
