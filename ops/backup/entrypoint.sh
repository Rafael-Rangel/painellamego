#!/bin/bash
set -euo pipefail

CRON_LINE="${BACKUP_CRON:-0 3 * * 0}"

# Exporta as envs do container para o crontab (cron não as herda)
ENV_FILE=/etc/backup.env
{
  for var in PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE BACKUP_RETENTION_DAYS TZ; do
    val="${!var:-}"
    [ -n "$val" ] && echo "$var=\"$val\"" || true
  done
} > "$ENV_FILE"

CRONTAB_FILE=/etc/crontabs/root
mkdir -p /etc/crontabs
{
  echo "# Lamego backup"
  echo "${CRON_LINE} . ${ENV_FILE}; /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
} > "$CRONTAB_FILE"

echo "[entrypoint] cron agendado: ${CRON_LINE} (TZ=${TZ:-UTC})"

# Roda 1 backup imediato no primeiro start (útil para validar config)
if [ "${RUN_ON_START:-true}" = "true" ]; then
  /usr/local/bin/backup.sh || echo "[entrypoint] backup inicial falhou (verifique credenciais)"
fi

# Tail do log para virar stdout do container + cron em foreground
touch /var/log/backup.log
crond -f -L /var/log/cron.log &
exec tail -F /var/log/backup.log
