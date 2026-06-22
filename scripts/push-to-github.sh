#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="https://github.com/logquick01-design/construction-timesheets.git"
USER="logquick01-design"

echo ""
echo "============================================"
echo "  Push to GitHub"
echo "============================================"
echo ""
echo "Paste works best if you type your token on the NEXT line"
echo "(it will be visible — delete this terminal history after)."
echo ""
echo "Steps:"
echo "  1. Copy your token from GitHub (starts with ghp_...)"
echo "  2. Click in this terminal window"
echo "  3. Press Cmd+V to paste (or right-click → Paste)"
echo "  4. Press Enter"
echo ""
printf "Paste token and press Enter: "
read -r TOKEN

if [[ -z "$TOKEN" ]]; then
  echo ""
  echo "ERROR: No token entered."
  exit 1
fi

echo ""
echo "Pushing to GitHub..."
echo ""

if git push "https://${USER}:${TOKEN}@github.com/logquick01-design/construction-timesheets.git" HEAD:main; then
  git remote set-url origin "$REMOTE"
  git branch --set-upstream-to=origin/main main 2>/dev/null || true
  echo ""
  echo "SUCCESS! Open: https://github.com/logquick01-design/construction-timesheets"
  echo ""
else
  echo ""
  echo "FAILED — create a new token at https://github.com/settings/tokens (check 'repo')"
  echo ""
  exit 1
fi
