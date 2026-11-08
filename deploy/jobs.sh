#!/bin/sh
# Runs inside the "jobs" container: schedules the daily rates fetch and backup with crond.
set -eu

cat > /etc/crontabs/root <<CRON
$RATES_AT /bin/sh /deploy/rates.sh >> /proc/1/fd/1 2>&1
$BACKUP_AT /bin/sh /deploy/backup.sh >> /proc/1/fd/1 2>&1
CRON

# crond starts jobs with an empty environment, so hand the settings over in a file.
export -p | grep -E 'PG|CRON_SECRET|BACKUP_KEEP_DAYS|TZ' > /tmp/job-env
chmod 600 /tmp/job-env

echo "jobs: rates at '$RATES_AT', backup at '$BACKUP_AT' ($TZ)"
exec crond -f -l 8
