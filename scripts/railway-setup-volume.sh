#!/usr/bin/env bash
set -euo pipefail

# Prefilled from your Railway project URL
PROJECT_ID="53203bd1-ac4c-4cf1-967a-dd5921276cdc"
SERVICE_NAME="construction-timesheets"
ENVIRONMENT_ID="f878af4a-c409-4eb3-a63e-4dcb3a4a1a12"
MOUNT_PATH="/data"

RAILWAY=(npx --yes @railway/cli)

echo ""
echo "============================================"
echo "  Railway volume setup for LogQ"
echo "============================================"
echo ""
echo "Project:  ${PROJECT_ID}"
echo "Service:  ${SERVICE_NAME}"
echo "Mount:    ${MOUNT_PATH}"
echo ""

if ! "${RAILWAY[@]}" whoami >/dev/null 2>&1; then
  echo "Opening Railway login in your browser..."
  echo "Complete the login, then return here."
  echo ""
  "${RAILWAY[@]}" login
fi

echo "Logged in as: $("${RAILWAY[@]}" whoami)"
echo ""

echo "Linking to your Railway project..."
"${RAILWAY[@]}" link \
  -p "$PROJECT_ID" \
  -e "$ENVIRONMENT_ID" \
  -s "$SERVICE_NAME"

echo ""
echo "Checking for an existing volume..."
EXISTING="$("${RAILWAY[@]}" volume list --json 2>/dev/null || echo "[]")"

if echo "$EXISTING" | grep -q "\"mountPath\":\"${MOUNT_PATH}\""; then
  echo "Volume already mounted at ${MOUNT_PATH}."
  echo "$EXISTING" | grep -A2 -B2 "\"mountPath\":\"${MOUNT_PATH}\"" || true
  echo ""
  echo "If the path was wrong before, it should now be fixed. Redeploying..."
  "${RAILWAY[@]}" redeploy --yes
  exit 0
fi

echo "Scaling to 1 replica (volumes require a single replica)..."
if ! "${RAILWAY[@]}" scale us-west=1 2>&1; then
  echo ""
  echo "Note: If scaling failed, open Railway → your service → Settings → Scaling"
  echo "      and set replicas to 1 manually, then run this script again."
  echo ""
fi

echo ""
echo "Creating volume at ${MOUNT_PATH}..."
"${RAILWAY[@]}" volume add -m "$MOUNT_PATH"

echo ""
echo "Redeploying..."
"${RAILWAY[@]}" redeploy --yes
