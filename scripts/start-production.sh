#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

if [[ "$USER_COUNT" == "0" ]]; then
  echo "Empty database — seeding demo data..."
  npx tsx prisma/seed.ts
else
  echo "Database already seeded ($USER_COUNT users)."
fi

PORT="${PORT:-3000}"
echo "Starting server on 0.0.0.0:${PORT}..."
exec npx next start -H 0.0.0.0 -p "$PORT"
