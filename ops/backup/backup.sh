#!/bin/bash
# Backup Postgres remoto (Supabase) usando pg_dump compatível com a versão alvo.
# Variáveis necessárias:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
#   BACKUP_RETENTION_DAYS (default 28)

set -euo pipefail

TS=$(date +%F-%H%M)
OUT_DIR=/backups
FILE="${OUT_DIR}/lamego-${TS}.sql.gz"
LOG_FILE=/var/log/backup.log

mkdir -p "${OUT_DIR}"

echo "[$(date)] iniciando backup -> ${FILE}" | tee -a "${LOG_FILE}"

pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT:-5432}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE:-postgres}" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --schema=public \
  --schema=storage \
  | gzip -9 > "${FILE}"

SIZE=$(du -h "${FILE}" | awk '{print $1}')
echo "[$(date)] backup ok (${SIZE})" | tee -a "${LOG_FILE}"

# Retenção: apaga arquivos com mais de N dias
RETENTION="${BACKUP_RETENTION_DAYS:-28}"
find "${OUT_DIR}" -type f -name 'lamego-*.sql.gz' -mtime "+${RETENTION}" -delete -print | tee -a "${LOG_FILE}" || true
echo "[$(date)] retencao aplicada (${RETENTION} dias)" | tee -a "${LOG_FILE}"
