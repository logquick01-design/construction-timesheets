#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Prefilled from your Railway project (same as railway-setup-volume.sh)
PROJECT_ID="53203bd1-ac4c-4cf1-967a-dd5921276cdc"
SERVICE_NAME="construction-timesheets"
ENVIRONMENT_ID="f878af4a-c409-4eb3-a63e-4dcb3a4a1a12"
DATA_MOUNT_PATH="/data"

RAILWAY=(npx --yes @railway/cli)
API=(bash "$ROOT/scripts/railway-api.sh")

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo ""
echo "============================================"
echo "  Railway backup setup for LogQ"
echo "============================================"
echo ""

if ! "${RAILWAY[@]}" whoami >/dev/null 2>&1; then
  echo "Opening Railway login in your browser..."
  "${RAILWAY[@]}" login
fi

echo "Logged in as: $("${RAILWAY[@]}" whoami)"
echo ""

echo "Linking to your Railway project..."
"${RAILWAY[@]}" link \
  -p "$PROJECT_ID" \
  -e "$ENVIRONMENT_ID" \
  -s "$SERVICE_NAME" >/dev/null

echo "Looking up the /data volume instance..."
"${API[@]}" \
  'query projectVolumes($projectId: String!) {
    project(id: $projectId) {
      volumes {
        edges {
          node {
            id
            name
            volumeInstances {
              edges {
                node {
                  id
                  mountPath
                  serviceId
                }
              }
            }
          }
        }
      }
    }
  }' \
  "{\"projectId\":\"${PROJECT_ID}\"}" > "$TMP_DIR/volumes.json"

VOLUME_INSTANCE_ID="$(python3 - "$TMP_DIR/volumes.json" "$DATA_MOUNT_PATH" "$SERVICE_NAME" <<'PY'
import json
import sys

path, mount_path, service_name = sys.argv[1:4]
data = json.loads(open(path).read())
if data.get("errors"):
    raise SystemExit("ERROR: " + json.dumps(data["errors"]))

found = None
for edge in data["data"]["project"]["volumes"]["edges"]:
    for inst_edge in edge["node"]["volumeInstances"]["edges"]:
        inst = inst_edge["node"]
        if inst.get("mountPath") == mount_path and inst.get("serviceId"):
            found = inst["id"]
            break
    if found:
        break

if not found:
    raise SystemExit(
        f"ERROR: No volume mounted at {mount_path} on {service_name}.\n"
        "Run: bash scripts/railway-setup-volume.sh"
    )

print(found)
PY
)"

echo "Volume instance: ${VOLUME_INSTANCE_ID}"
echo ""

echo "Current Railway snapshot schedules:"
"${API[@]}" \
  'query volumeInstanceBackupScheduleList($volumeInstanceId: String!) {
    volumeInstanceBackupScheduleList(volumeInstanceId: $volumeInstanceId) {
      id
      kind
      name
      cron
      retentionSeconds
    }
  }' \
  "{\"volumeInstanceId\":\"${VOLUME_INSTANCE_ID}\"}" | python3 -m json.tool
echo ""

NATIVE_OK=0
echo "Enabling Daily + Weekly Railway volume snapshots..."
if "${API[@]}" \
  'mutation volumeInstanceBackupScheduleUpdate($volumeInstanceId: String!, $kinds: [VolumeInstanceBackupScheduleKind!]!) {
    volumeInstanceBackupScheduleUpdate(volumeInstanceId: $volumeInstanceId, kinds: $kinds)
  }' \
  "{\"volumeInstanceId\":\"${VOLUME_INSTANCE_ID}\",\"kinds\":[\"DAILY\",\"WEEKLY\"]}" > "$TMP_DIR/schedules.json"; then
  if python3 - "$TMP_DIR/schedules.json" <<'PY'
import json
import sys

data = json.loads(open(sys.argv[1]).read())
if data.get("errors"):
    msg = json.dumps(data["errors"])
    if "Not Authorized" in msg:
        print("Railway native snapshots require a Pro plan or dashboard access.")
        sys.exit(2)
    raise SystemExit("ERROR enabling schedules:\n" + json.dumps(data["errors"], indent=2))

if not data["data"]["volumeInstanceBackupScheduleUpdate"]:
    raise SystemExit("ERROR: Railway did not enable snapshot schedules.")
print("Daily + Weekly Railway snapshot schedules enabled.")
PY
  then
    NATIVE_OK=0
  else
    NATIVE_OK=$?
  fi
else
  NATIVE_OK=2
fi

if [[ "$NATIVE_OK" -eq 2 ]]; then
  echo ""
  echo "Enable Railway snapshots manually (recommended on Pro):"
  echo "  1. Open https://railway.com/project/${PROJECT_ID}"
  echo "  2. Select ${SERVICE_NAME} → Backups tab"
  echo "  3. Edit schedule → enable Daily + Weekly"
  echo ""
fi

echo "Creating an immediate Railway snapshot (if authorized)..."
"${API[@]}" \
  'mutation volumeInstanceBackupCreate($volumeInstanceId: String!) {
    volumeInstanceBackupCreate(volumeInstanceId: $volumeInstanceId) { workflowId }
  }' \
  "{\"volumeInstanceId\":\"${VOLUME_INSTANCE_ID}\"}" > "$TMP_DIR/backup.json" || true

python3 - "$TMP_DIR/backup.json" <<'PY'
import json
import sys

data = json.loads(open(sys.argv[1]).read())
if data.get("errors"):
    if any("Not Authorized" in e.get("message", "") for e in data["errors"]):
        print("Skipped immediate Railway snapshot (Pro/dashboard required).")
    else:
        print("WARNING:", json.dumps(data["errors"], indent=2))
else:
    print("Initial Railway snapshot requested:", data["data"]["volumeInstanceBackupCreate"]["workflowId"])
PY

echo ""
echo "App-level SQLite backups are enabled in scripts/start-production.sh:"
echo "  - One backup on every deploy/restart"
echo "  - Automatic backups every 6 hours to /data/backups/"
echo "  - Keeps the latest 14 copies"
echo ""
echo "Redeploy to activate app-level backups:"
echo "  npx @railway/cli redeploy --yes"
echo ""
echo "View backups:"
echo "  Railway snapshots: ${SERVICE_NAME} → Backups tab"
echo "  SQLite copies: npx @railway/cli volume files list /backups"
echo ""
