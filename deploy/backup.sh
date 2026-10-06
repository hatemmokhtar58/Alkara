#!/usr/bin/env bash
# Daily MySQL backup: dump the database, keep a copy on the server and upload one off the server.
# Run from anywhere; settings come from deploy/.env. Installed as a daily timer by deploy/systemd/.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
set -a; . "$DEPLOY_DIR/.env"; set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/alkara}"
KEEP_LOCAL="${BACKUP_KEEP_LOCAL_DAYS:-7}"
KEEP_REMOTE="${BACKUP_KEEP_REMOTE_DAYS:-30}"
STAMP="$(TZ=Asia/Riyadh date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/alkara_db_$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# --single-transaction gives a consistent snapshot without locking the app
docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T db \
  sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces --databases alkara_db' \
  | gzip -9 > "$FILE.partial"

# Refuse to keep a dump that did not finish
gzip -t "$FILE.partial"
zcat "$FILE.partial" | tail -n 1 | grep -q "Dump completed" || { echo "Backup incomplete: $FILE.partial" >&2; exit 1; }
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'alkara_db_*.sql.gz' -mtime +"$KEEP_LOCAL" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_REMOTE"
  rclone delete "$BACKUP_REMOTE" --min-age "${KEEP_REMOTE}d" --include 'alkara_db_*.sql.gz'
  echo "Uploaded to $BACKUP_REMOTE"
else
  echo "BACKUP_REMOTE is not set: the backup is only on this server" >&2
  exit 2
fi
