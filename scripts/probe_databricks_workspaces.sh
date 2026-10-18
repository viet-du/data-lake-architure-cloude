#!/usr/bin/env bash
# Check if the token works against the original host mentioned in older
# .env.databricks.template (https://dbc-70e4e968-2b60.cloud.databricks.com/).
# Useful when the token was generated on a different workspace.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
set -a; source .env; set +a

: "${DATABRICKS_TOKEN:?missing}"

mask() {
  local t="$1"
  if [ "${#t}" -le 8 ]; then echo "***"; return; fi
  echo "${t:0:4}...${t: -2}"
}

echo "═══════════════════════════════════════════════════"
echo "Token Workspace Checker"
echo "═══════════════════════════════════════════════════"
echo "Token: $(mask "$DATABRICKS_TOKEN") (length=${#DATABRICKS_TOKEN})"
echo ""
echo "Testing against known Databricks CE hostnames..."
echo ""

hosts=(
  "https://community.cloud.databricks.com"
  "https://dbc-70e4e968-2b60.cloud.databricks.com"
  "https://community.databricks.com"
)

for host in "${hosts[@]}"; do
  code=$(curl -sS -o /tmp/_probe.json -w '%{http_code}' \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    "${host}/api/2.0/preview/scim/v2/Me")
  body=$(head -c 120 /tmp/_probe.json)
  echo "  $host"
  echo "    HTTP $code — $body"
  echo ""
done

echo "═══════════════════════════════════════════════════"
echo "Next steps:"
echo "  1. If ALL return 401: token is invalid/expired — generate new one"
echo "     at https://community.cloud.databricks.com → User Settings"
echo "     → Developer → Access Tokens"
echo "  2. If ONE returns 200: your token is for that workspace."
echo "     Update DATABRICKS_HOST in .env to match."
echo "  3. If browser login fails too: your CE account may be inactive"
echo "     (CE deletes accounts unused for >60 days)."
echo "═══════════════════════════════════════════════════"
