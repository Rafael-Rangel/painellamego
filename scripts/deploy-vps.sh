#!/usr/bin/env bash
# Deploy Lamego em /opt/lamego (nginx-proxy + acme-companion na mesma VPS).
# Não altera /opt/jada nem containers jada-*.
set -euo pipefail

LAMEGO_DIR="${LAMEGO_DIR:-/opt/lamego}"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE=(
  docker compose
  -f docker-compose.yml
  -f docker-compose.nginxproxy.yml
)

cd "${LAMEGO_DIR}"

# Git 2.35+ com repo owned por outro utilizador (ex.: ubuntu) precisa disto quando o script corre como root.
if [[ -d .git ]] && ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "${LAMEGO_DIR}"; then
  git config --global --add safe.directory "${LAMEGO_DIR}"
fi

if [[ ! -f .env.production ]]; then
  echo "Erro: ${LAMEGO_DIR}/.env.production não existe. Copie de .env.production.example e preencha os segredos." >&2
  exit 1
fi

# Compose lê variáveis do .env na raiz para interpolação (ex.: backup)
if [[ -f .env.production ]]; then
  cp -f .env.production .env
fi

if [[ -d .git ]]; then
  git fetch origin "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
else
  echo "Aviso: ${LAMEGO_DIR} não é um repositório Git. Pule git pull ou faça: git clone ... ${LAMEGO_DIR}" >&2
fi

"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps

echo "Deploy concluído. Health: curl -sS https://painellamego.com.br/api/health"
