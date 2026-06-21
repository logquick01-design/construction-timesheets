#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_FILENAME="prod.db"
DEFAULT_VOLUME_MOUNT="/data"

is_ephemeral_database_url() {
  local url="${1:-}"
  [[ -z "$url" ]] && return 0
  [[ "$url" == *"dev.db"* ]] && return 0
  [[ "$url" == file:./dev.db ]] && return 0
  [[ "$url" == file:dev.db ]] && return 0
  return 1
}

resolve_database_url() {
  local mount_path="${RAILWAY_VOLUME_MOUNT_PATH:-$DEFAULT_VOLUME_MOUNT}"
  local persistent_url="file:${mount_path}/${DB_FILENAME}"

  if is_ephemeral_database_url "${DATABASE_URL:-}"; then
    if [[ -n "${DATABASE_URL:-}" ]]; then
      echo "WARNING: DATABASE_URL points at a non-persistent dev database."
      echo "         Overriding with ${persistent_url}"
    else
      echo "DATABASE_URL not set — using persistent path: ${persistent_url}"
    fi
    export DATABASE_URL="$persistent_url"
    return
  fi

  if [[ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]] && [[ "$DATABASE_URL" != *"$RAILWAY_VOLUME_MOUNT_PATH"* ]]; then
    echo "WARNING: DATABASE_URL does not use the mounted Railway volume."
    echo "         Volume mount: ${RAILWAY_VOLUME_MOUNT_PATH}"
    echo "         DATABASE_URL:   ${DATABASE_URL}"
    echo "         Data may not survive redeploys. Consider: ${persistent_url}"
  fi

  echo "Using DATABASE_URL: ${DATABASE_URL}"
}

ensure_database_directory() {
  local db_path="${DATABASE_URL#file:}"
  local db_dir
  db_dir="$(dirname "$db_path")"
  mkdir -p "$db_dir"

  if [[ ! -w "$db_dir" ]]; then
    echo "ERROR: Database directory is not writable: ${db_dir}" >&2
    exit 1
  fi

  if [[ -f "$db_path" ]]; then
    echo "Database file found at ${db_path} ($(wc -c < "$db_path" | tr -d ' ') bytes)"
  else
    echo "Database file will be created at ${db_path}"
  fi
}

warn_if_railway_without_volume() {
  if [[ -n "${RAILWAY_ENVIRONMENT:-}" || -n "${RAILWAY_PROJECT_ID:-}" ]] && [[ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]]; then
    echo ""
    echo "================================================================"
    echo "WARNING: Running on Railway without a persistent volume."
    echo "         Timesheet data will be LOST on every redeploy."
    echo ""
    echo "Fix: Project canvas → right-click (or Cmd/Ctrl+K → Volume)"
    echo "     Mount path: ${DEFAULT_VOLUME_MOUNT}"
    echo "     Then redeploy."
    echo "================================================================"
    echo ""
  fi
}

require_auth_secret() {
  if [[ -z "${AUTH_SECRET:-}" ]]; then
    echo "ERROR: AUTH_SECRET is not set. Add it in Railway → Variables." >&2
    exit 1
  fi
}

resolve_database_url
ensure_database_directory
warn_if_railway_without_volume
require_auth_secret

echo "Applying database schema..."
npx prisma db push --skip-generate

USER_COUNT="$(node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.user
  .count()
  .then((count) => process.stdout.write(String(count)))
  .catch(() => process.stdout.write("0"))
  .finally(() => prisma.$disconnect());
NODE
)"

PORT="${PORT:-3000}"
echo "Starting server on 0.0.0.0:${PORT}..."
node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "$PORT" &
NEXT_PID=$!

if [[ "$USER_COUNT" == "0" ]]; then
  echo "Empty database — seeding demo data..."
  npx tsx prisma/seed.ts
else
  echo "Database already seeded ($USER_COUNT users)."
fi

wait "$NEXT_PID"
