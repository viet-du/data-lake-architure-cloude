#!/usr/bin/env bash
# Quick Databricks auth diagnostic (safe — does NOT print full token)
# Usage:  bash scripts/diag_databricks.sh
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
set -a; source .env; set +a

: "${DATABRICKS_TOKEN:?DATABRICKS_TOKEN is required}"
: "${DATABRICKS_HOST:?DATABRICKS_HOST is required}"

# Mask token for printing: show only first 4 + last 2 chars
mask() {
  local t="$1"
  if [ "${#t}" -le 8 ]; then echo "***"; return; fi
  echo "${t:0:4}...${t: -2}"
}

echo "═══════════════════════════════════════════════════"
echo "Databricks Auth Diagnostic"
echo "═══════════════════════════════════════════════════"
echo "HOST    : $DATABRICKS_HOST"
echo "TOKEN   : $(mask "$DATABRICKS_TOKEN") (length=${#DATABRICKS_TOKEN})"
echo "CATALOG : ${DATABRICKS_CATALOG:-<unset>}"
echo ""

test_host() {
  local label="$1"
  local host="$2"
  echo "───────────────────────────────────────────────────"
  echo "[$label] $host"
  local code
  code=$(curl -sS -o /tmp/_diag.json -w '%{http_code}' \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    "${host}/api/2.0/preview/scim/v2/Me")
  echo "  HTTP $code"
  head -c 400 /tmp/_diag.json
  echo ""
  echo ""
}

test_host "1. HOST in .env" "$DATABRICKS_HOST"
test_host "2. community.cloud" "https://community.cloud.databricks.com"

echo "═══════════════════════════════════════════════════"
echo "Suggestions:"
echo "  - 401: token invalid/expired. Regenerate in Databricks UI."
echo "  - 403: token doesn't have access to workspace (wrong URL)."
echo "  - 200: auth OK — proceed to schema/volume bootstrap."
echo "═══════════════════════════════════════════════════"
