#!/usr/bin/env bash
# Copia timeouts do Lamego para o volume jada_vhostd e recarrega o nginx-proxy.
set -euo pipefail

VHOSTD="${JADA_VHOSTD:-/var/lib/docker/volumes/jada_vhostd/_data}"
SRC_DIR="$(cd "$(dirname "$0")/../ops/deploy/nginx-proxy" && pwd)"

for host in painellamego.com.br www.painellamego.com.br; do
  cp -f "${SRC_DIR}/${host}_location" "${VHOSTD}/${host}_location"
  echo "OK ${VHOSTD}/${host}_location"
done

docker exec jada-nginx-proxy nginx -t
docker exec jada-nginx-proxy nginx -s reload
echo "nginx-proxy recarregado (proxy_read_timeout 300s para Lamego)."
