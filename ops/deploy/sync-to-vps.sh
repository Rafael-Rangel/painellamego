#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-root@2.24.87.222}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lamego}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml}"
SSH_PASS="${SSH_PASS:-}"

if [[ -z "${SSH_PASS}" ]]; then
  echo "Defina SSH_PASS com a senha da VPS (ou use chave SSH e deixe vazio)." >&2
  exit 1
fi

if ! command -v sshpass >/dev/null 2>&1; then
  echo "Instale sshpass para usar este script com senha." >&2
  exit 1
fi

export SSHPASS="${SSH_PASS}"
RSYNC_SSH="sshpass -e ssh -o StrictHostKeyChecking=no"

sshpass -e ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}'"

rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude apps/api/uploads \
  --exclude ops/backup/backups \
  --exclude .env \
  --exclude .env.local \
  -e "${RSYNC_SSH}" \
  "${ROOT_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

sshpass -e ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
if [[ ! -f .env.production ]]; then
  echo "Crie .env.production na VPS antes de subir os containers." >&2
  exit 1
fi
docker compose ${COMPOSE_FILES} build
docker compose ${COMPOSE_FILES} up -d
docker compose ${COMPOSE_FILES} ps
EOF
