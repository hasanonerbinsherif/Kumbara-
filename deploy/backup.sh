#!/bin/sh
# Daily backup: a compressed database dump and a copy of the receipts, kept for BACKUP_KEEP_DAYS days.
set -eu
[ -f /tmp/job-env ] && . /tmp/job-env
stamp=$(date +%Y-%m-%d_%H%M)
mkdir -p /backups

pg_dump --format=custom --file="/backups/db-$stamp.dump.tmp"
mv "/backups/db-$stamp.dump.tmp" "/backups/db-$stamp.dump"

tar -czf "/backups/receipts-$stamp.tar.gz.tmp" -C /data receipts
mv "/backups/receipts-$stamp.tar.gz.tmp" "/backups/receipts-$stamp.tar.gz"

find /backups -name 'db-*.dump' -mtime "+${BACKUP_KEEP_DAYS:-14}" -delete
find /backups -name 'receipts-*.tar.gz' -mtime "+${BACKUP_KEEP_DAYS:-14}" -delete
echo "$(date -Iseconds) backup: db-$stamp.dump, receipts-$stamp.tar.gz"
