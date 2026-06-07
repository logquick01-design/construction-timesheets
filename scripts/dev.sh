#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_DIR="$ROOT/.tools/node-v22.16.0-darwin-arm64"

if [[ ! -x "$NODE_DIR/bin/npm" ]]; then
  echo "Node not found in .tools/. Run from project root:"
  echo "  curl -fsSL https://nodejs.org/dist/v22.16.0/node-v22.16.0-darwin-arm64.tar.gz | tar -xz -C .tools"
  echo "Or install Node.js from https://nodejs.org/ and use: npm install && npm run db:setup && npm run dev"
  exit 1
fi

export PATH="$NODE_DIR/bin:$PATH"
cd "$ROOT"

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -f prisma/dev.db ]]; then
  npm run db:setup
fi

exec npm run dev
