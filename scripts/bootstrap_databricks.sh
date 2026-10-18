#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Bootstrap Unity Catalog for the data-lake-architecture project.
#
# Idempotent — safe to re-run. Creates (if missing):
#   - Catalog: $DATABRICKS_CATALOG (default: workspace, or `databricks://` for full workspaces)
#   - Schemas: bronze, silver, gold
#   - Managed Volumes per layer (for ENV=databricks + DATABRICKS_PATH_MODE=volume):
#       workspace.bronze.bronze_data
#       workspace.silver.silver_data
#       workspace.gold.gold_data
#       workspace.bronze.checkpoints  (shared checkpoint volume)
#
# Works on both Community Edition and full Databricks workspaces.
#
# Usage:
#   bash scripts/bootstrap_databricks.sh
#   CATALOG=lakehouse bash scripts/bootstrap_databricks.sh   # custom catalog
# ═══════════════════════════════════════════════════════════════
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env not found at $REPO_ROOT/.env"
  echo "       Run: cp .env.databricks.template .env and fill in DATABRICKS_TOKEN."
  exit 1
fi
set -a; source .env; set +a

: "${DATABRICKS_HOST:?DATABRICKS_HOST is required}"
: "${DATABRICKS_TOKEN:?DATABRICKS_TOKEN is required}"
CATALOG="${CATALOG:-${DATABRICKS_CATALOG:-workspace}}"

# ── token sanity ──────────────────────────────────────────────
TOKEN_PREFIX="${DATABRICKS_TOKEN:0:4}"
TOKEN_LEN="${#DATABRICKS_TOKEN}"
if [ "$TOKEN_PREFIX" != "dapi" ] || [ "$TOKEN_LEN" -lt 32 ]; then
  echo "  ❌ DATABRICKS_TOKEN looks wrong (prefix=$TOKEN_PREFIX, length=$TOKEN_LEN)"
  exit 1
fi
echo "  ✓ Token format OK"
echo "  ✓ HOST=$DATABRICKS_HOST  CATALOG=$CATALOG"

hr() { printf '\n%s\n' "──────────────────────────────────────────────────────────────"; }

# ── API helper ────────────────────────────────────────────────
req() {
  local method="$1" path="$2" body="${3:-}"
  local args=( -sS -X "$method" -H "Authorization: Bearer $DATABRICKS_TOKEN" )
  if [ -n "$body" ]; then
    args+=( -H "Content-Type: application/json" -d "$body" )
  fi
  curl "${args[@]}" "${DATABRICKS_HOST}${path}"
}

req_code() {
  local method="$1" path="$2" body="${3:-}"
  local args=( -sS -X "$method" -o /tmp/_bs.json -w '%{http_code}' \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" )
  if [ -n "$body" ]; then
    args+=( -H "Content-Type: application/json" -d "$body" )
  fi
  curl "${args[@]}" "${DATABRICKS_HOST}${path}"
}

# ── 0. Auth check ─────────────────────────────────────────────
hr
echo "[0/5] Auth check (GET /api/2.0/preview/scim/v2/Me)"
HTTP="$(req_code GET /api/2.0/preview/scim/v2/Me)"
if [ "$HTTP" != "200" ]; then
  echo "  ❌ Auth FAILED (HTTP $HTTP)"
  cat /tmp/_bs.json
  echo ""
  echo "  → Regenerate token at User Settings → Developer → Access tokens"
  exit 1
fi
USER_NAME="$(python3 -c "import json,sys;print(json.load(open('/tmp/_bs.json')).get('userName','?'))")"
echo "  ✅ Auth OK — user=$USER_NAME"

# ── 1. Catalog (only on full workspaces; CE uses 'workspace') ──
hr
echo "[1/5] Catalog check (catalog='$CATALOG')"
if [ "$CATALOG" = "workspace" ]; then
  echo "  ✓ Using default catalog 'workspace' (Community Edition default)"
else
  resp="$(req_code POST /api/2.1/unity-catalog/catalogs \
    "{\"name\":\"$CATALOG\",\"comment\":\"data-lake-architecture managed catalog\"}")"
  case "$resp" in
    200) echo "  ✅ Created catalog '$CATALOG'" ;;
    409) echo "  ✓  Catalog '$CATALOG' already exists" ;;
    *)
      body="$(cat /tmp/_bs.json)"
      if echo "$body" | grep -qi "already.*exists\|catalog.*exists"; then
        echo "  ✓  Catalog '$CATALOG' already exists"
      else
        echo "  ❌ Failed to create catalog (HTTP $resp): $body"
        exit 1
      fi
      ;;
  esac
fi

# ── 2. Schemas (bronze, silver, gold) ────────────────────────
hr
echo "[2/5] Ensure schemas exist (bronze, silver, gold)"
for layer in bronze silver gold; do
  resp="$(req_code POST /api/2.1/unity-catalog/schemas \
    "{\"catalog_name\":\"$CATALOG\",\"name\":\"$layer\",\"comment\":\"Medallion $layer layer\"}")"
  body="$(cat /tmp/_bs.json)"
  case "$resp" in
    200) echo "  ✅ Created $CATALOG.$layer" ;;
    409) echo "  ✓  $CATALOG.$layer already exists" ;;
    400)
      if echo "$body" | grep -qi "already.*exists\|schema.*exists\|RESOURCE_ALREADY_EXISTS"; then
        echo "  ✓  $CATALOG.$layer already exists"
      else
        echo "  ❌ Failed to create $layer (HTTP $resp): $body"
      fi
      ;;
    *) echo "  ❌ Failed to create $layer (HTTP $resp): $body" ;;
  esac
done

# ── 3. Managed Volumes (one per layer + one shared checkpoint) ─
hr
echo "[3/5] Ensure managed volumes exist (per layer + shared checkpoint)"
declare -A VOLS=(
  [bronze]="${DATABRICKS_BRONZE_VOLUME:-bronze_data}"
  [silver]="${DATABRICKS_SILVER_VOLUME:-silver_data}"
  [gold]="${DATABRICKS_GOLD_VOLUME:-gold_data}"
  [bronze_cp_vol]="${DATABRICKS_CHECKPOINT_VOLUME:-checkpoints}"
)
# Checkpoint volume is created under the bronze schema (any schema works; we
# pick bronze because checkpoints for bronze ingestion land there first).
for layer in bronze silver gold; do
  vol_name="${VOLS[$layer]}"
  resp="$(req_code POST /api/2.1/unity-catalog/volumes \
    "{\"catalog_name\":\"$CATALOG\",\"schema_name\":\"$layer\",\"name\":\"$vol_name\",\"volume_type\":\"MANAGED\"}")"
  body="$(cat /tmp/_bs.json)"
  case "$resp" in
    200) echo "  ✅ Created volume $CATALOG.$layer.$vol_name" ;;
    409) echo "  ✓  $CATALOG.$layer.$vol_name already exists" ;;
    400)
      if echo "$body" | grep -qi "already.*exists\|volume.*exists\|RESOURCE_ALREADY_EXISTS"; then
        echo "  ✓  $CATALOG.$layer.$vol_name already exists"
      else
        echo "  ❌ Failed to create $layer.$vol_name (HTTP $resp): $body"
      fi
      ;;
    *) echo "  ❌ Failed to create $layer.$vol_name (HTTP $resp): $body" ;;
  esac
done

# Checkpoint volume
cp_vol="${VOLS[bronze_cp_vol]}"
resp="$(req_code POST /api/2.1/unity-catalog/volumes \
  "{\"catalog_name\":\"$CATALOG\",\"schema_name\":\"bronze\",\"name\":\"$cp_vol\",\"volume_type\":\"MANAGED\"}")"
body="$(cat /tmp/_bs.json)"
case "$resp" in
  200) echo "  ✅ Created volume $CATALOG.bronze.$cp_vol (checkpoints)" ;;
  409) echo "  ✓  $CATALOG.bronze.$cp_vol already exists" ;;
  400)
    if echo "$body" | grep -qi "already.*exists\|volume.*exists\|RESOURCE_ALREADY_EXISTS"; then
      echo "  ✓  $CATALOG.bronze.$cp_vol already exists"
    else
      echo "  ❌ Failed to create checkpoint volume (HTTP $resp): $body"
    fi
    ;;
  *) echo "  ❌ Failed to create checkpoint volume (HTTP $resp): $body" ;;
esac

# ── 4. Verify by listing resources ────────────────────────────
hr
echo "[4/5] Verify resources"
echo "  Schemas in $CATALOG:"
req GET "/api/2.1/unity-catalog/schemas?catalog_name=$CATALOG" | \
  python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  for s in d.get('schemas', []):
    print(f'    - {s[\"name\"]}')
except Exception as e:
  print(f'    (could not parse: {e})')"

echo "  Volumes in $CATALOG.bronze:"
req GET "/api/2.1/unity-catalog/volumes?catalog_name=$CATALOG&schema_name=bronze" | \
  python3 -c "
import json, sys
try:
  d = json.load(sys.stdin)
  for v in d.get('volumes', []):
    print(f'    - {v[\"name\"]} ({v.get(\"volume_type\",\"?\")})')
except Exception as e:
  print(f'    (could not parse: {e})')"

# ── 5. End-to-end smoke write/read ────────────────────────────
hr
echo "[5/5] Smoke write/read inside $CATALOG.bronze.bronze_data"
SMOKE_FILE="smoke_$(date +%s).txt"
SMOKE_CONTENT="hello from data-lake-architecture @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
WRITE_PATH="/Volumes/$CATALOG/bronze/${VOLS[bronze]}/$SMOKE_FILE"
WRITE_HTTP="$(req_code PUT "/api/2.0/fs/files${WRITE_PATH}" \
  "" <<< "$SMOKE_CONTENT")"
# PUT with --data-binary: use a separate call so we can stream body
WRITE_HTTP="$(curl -sS -o /tmp/_bs.json -w '%{http_code}' \
  -X PUT -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "$SMOKE_CONTENT" \
  "${DATABRICKS_HOST}/api/2.0/fs/files${WRITE_PATH}")"
if [ "$WRITE_HTTP" != "200" ] && [ "$WRITE_HTTP" != "204" ]; then
  echo "  ❌ Write FAILED (HTTP $WRITE_HTTP)"
  cat /tmp/_bs.json
  exit 1
fi
echo "  ✅ Wrote: $WRITE_PATH"

curl -sS -o /tmp/_bs_read.txt -w '  Read HTTP %{http_code}\n' \
  -X GET -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "${DATABRICKS_HOST}/api/2.0/fs/files${WRITE_PATH}" || true

if ! diff -q /tmp/_bs_read.txt <(printf '%s' "$SMOKE_CONTENT") >/dev/null 2>&1; then
  echo "  ❌ Read content mismatch"
  echo "     expected: $(printf '%s' "$SMOKE_CONTENT" | head -c 80)"
  echo "     got     : $(head -c 80 /tmp/_bs_read.txt 2>/dev/null)"
  exit 1
fi
echo "  ✅ Read content matches: '$(head -c 60 /tmp/_bs_read.txt)...'"

# cleanup
curl -sS -o /dev/null -X DELETE \
  -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "${DATABRICKS_HOST}/api/2.0/fs/files${WRITE_PATH}" >/dev/null 2>&1 || true

hr
echo "🎉 Bootstrap complete. You can now run:"
echo "   ENV=databricks make pipeline-batch"
echo "   ENV=databricks make stream-clickstream"
echo "   # Or via Databricks notebook, after uploading src/ to /Workspace/"
