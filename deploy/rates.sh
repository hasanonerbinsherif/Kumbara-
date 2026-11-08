#!/bin/sh
# Asks the app to fetch the latest exchange rates.
set -u
. /tmp/job-env
if out=$(wget -q -O - --header "Authorization: Bearer $CRON_SECRET" http://app:3000/api/cron/rates 2>&1); then
  echo "$(date -Iseconds) rates: $out"
else
  echo "$(date -Iseconds) rates FAILED: $out"
  exit 1
fi
