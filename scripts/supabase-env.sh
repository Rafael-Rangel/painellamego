#!/usr/bin/env bash
# Carrega SUPABASE_* do .env sem interpretar valores com espaços (ex.: OPENROUTER_APP_TITLE).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DOTENV_CONFIG_PATH:-$ROOT/.env}"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$ROOT/.env.production"
[[ -f "$ENV_FILE" ]] || { echo "Erro: .env ou .env.production com SUPABASE_DB_PASSWORD." >&2; exit 1; }

read_env_var() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

SUPABASE_DB_PASSWORD="$(read_env_var "$ENV_FILE" SUPABASE_DB_PASSWORD)"
SUPABASE_PROJECT_REF="$(read_env_var "$ENV_FILE" SUPABASE_PROJECT_REF)"

: "${SUPABASE_DB_PASSWORD:?Falta SUPABASE_DB_PASSWORD em $ENV_FILE}"
: "${SUPABASE_PROJECT_REF:?Falta SUPABASE_PROJECT_REF em $ENV_FILE}"

export SUPABASE_DB_PASSWORD SUPABASE_PROJECT_REF
export DB_URL="postgresql://postgres:$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$SUPABASE_DB_PASSWORD")@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
