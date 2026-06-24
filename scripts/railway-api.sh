#!/usr/bin/env bash
set -euo pipefail

# Lightweight GraphQL helper for Railway settings the CLI does not expose.
# Usage: scripts/railway-api.sh '<query-or-mutation>' '<variables-json>'

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/railway-api.sh '<query>' ['<variables-json>']" >&2
  exit 1
fi

QUERY="$1"
VARIABLES="${2:-"{}"}"

CONFIG="${HOME}/.railway/config.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: Railway CLI is not logged in. Run: npx @railway/cli login" >&2
  exit 1
fi

TOKEN="$(python3 - <<'PY'
import json
import os
from pathlib import Path

config_path = Path(os.path.expanduser("~/.railway/config.json"))
config = json.loads(config_path.read_text())
token = config.get("user", {}).get("accessToken")
if not token:
    raise SystemExit("ERROR: No Railway access token in ~/.railway/config.json. Run: npx @railway/cli login")
print(token)
PY
)"

PAYLOAD="$(python3 - "$QUERY" "$VARIABLES" <<'PY'
import json
import sys

query, variables_raw = sys.argv[1], sys.argv[2]
variables = json.loads(variables_raw)
print(json.dumps({"query": query, "variables": variables}))
PY
)"

curl -sS -X POST "https://backboard.railway.com/graphql/v2" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
