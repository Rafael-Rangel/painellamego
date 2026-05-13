FROM postgres:16-alpine

RUN apk add --no-cache busybox-suid bash gzip tzdata && \
    mkdir -p /backups /var/log

ENV TZ=America/Sao_Paulo
ENV BACKUP_RETENTION_DAYS=28
ENV BACKUP_CRON="0 3 * * 0"

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh

VOLUME ["/backups"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
