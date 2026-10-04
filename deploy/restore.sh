#!/usr/bin/env bash
# Restore a backup made by backup.sh. This REPLACES the current database.
#   ./restore.sh /var/backups/alkara/alkara_db_2026-10-05_0300.sql.gz
#   ./restore.sh latest            # newest backup on the off-server storage
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
set -a; . "$DEPLOY_DIR/.env"; set +a
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml")

SRC="${1:?usage: restore.sh <backup.sql.gz | latest>}"
if [ "$SRC" = latest ]; then
  NAME="$(rclone lsf "$BACKUP_REMOTE" --include 'alkara_db_*.sql.gz' | sort | tail -n 1)"
  [ -n "$NAME" ] || { echo "No backups found on $BACKUP_REMOTE" >&2; exit 1; }
  SRC="$(mktemp -d)/$NAME"
  rclone copyto "$BACKUP_REMOTE/$NAME" "$SRC"
fi
gzip -t "$SRC"

if [ "${RESTORE_YES:-}" != 1 ]; then
  read -r -p "Replace the current database with $(basename "$SRC")? Type yes: " answer
  [ "$answer" = yes ] || { echo "Cancelled"; exit 1; }
fi

"${COMPOSE[@]}" stop api
# The dump contains CREATE DATABASE; drop first so tables removed since then do not linger
"${COMPOSE[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "DROP DATABASE IF EXISTS alkara_db"'
zcat "$SRC" | "${COMPOSE[@]}" exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'
"${COMPOSE[@]}" start api
echo "Restored $(basename "$SRC")"
