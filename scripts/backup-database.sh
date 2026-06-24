#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_FILENAME="prod.db"
DEFAULT_VOLUME_MOUNT="/data"

resolve_database_url() {
  local mount_path="${RAILWAY_VOLUME_MOUNT_PATH:-$DEFAULT_VOLUME_MOUNT}"
  export DATABASE_URL="${DATABASE_URL:-file:${mount_path}/${DB_FILENAME}}"
}

resolve_database_url

echo "Running database backup..."
echo "DATABASE_URL=${DATABASE_URL}"
node "$ROOT/scripts/backup-database.mjs"
echo "Backup complete."
