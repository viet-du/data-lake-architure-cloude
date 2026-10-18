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

# If the user didn't pin CATALOG in .env, try to auto-detect the default
# catalog from the workspace. Personal CE workspaces typically expose a
# catalog named after the user (e.g. "duviet"), not "workspace".
if [ -z "${CATALOG:-}" ] && [ -z "${DATABRICKS_CATALOG:-}" ]; then
  echo "  • Auto-detecting default catalog from workspace…"
  DETECTED="$(curl -sS -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    "${DATABRICKS_HOST}/api/2.1/unity-catalog/catalogs" | \
    python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    catalogs = [c['name'] for c in d.get('catalogs', [])]
    # Prefer 'workspace' (CE default), then alphabetically first non-system
    if 'workspace' in catalogs:
        print('workspace')
    elif catalogs:
        print(sorted(catalogs)[0])
    else:
        print('')
except Exception as e:
    print('')
" 2>/dev/null)"
  if [ -n "$DETECTED" ]; then
    echo "    → Detected catalog: $DETECTED"
    CATALOG="$DETECTED"
  else
    CATALOG="workspace"  # safe default for CE
  fi
elif [ -n "${CATALOG:-}" ]; then
  :  # user-provided
else
  CATALOG="$DATABRICKS_CATALOG"
fi
export CATALOG

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

# ── 1. Catalog (auto-skip create if it already exists) ────────
hr
echo "[1/5] Catalog check (catalog='$CATALOG')"
# First, list catalogs and see if $CATALOG already exists.
EXISTING_CATALOGS="$(req GET /api/2.1/unity-catalog/catalogs | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(' '.join(c['name'] for c in d.get('catalogs',[])))" 2>/dev/null || echo "")"
if echo " $EXISTING_CATALOGS " | grep -q " $CATALOG "; then
  echo "  ✓ Catalog '$CATALOG' already exists"
else
  resp="$(req_code POST /api/2.1/unity-catalog/catalogs \
    "{\"name\":\"$CATALOG\",\"comment\":\"data-lake-architecture managed catalog\"}")"
  case "$resp" in
    200) echo "  ✅ Created catalog '$CATALOG'" ;;
    409|400)
      body="$(cat /tmp/_bs.json)"
      if echo "$body" | grep -qi "already.*exists\|catalog.*exists"; then
        echo "  ✓ Catalog '$CATALOG' already exists (or is reserved)"
      else
        echo "  ⚠️  Could not create catalog '$CATALOG' (HTTP $resp): $body"
        echo "      Will continue with auto-detected catalogs only."
      fi
      ;;
    *)
      body="$(cat /tmp/_bs.json)"
      echo "  ⚠️  Could not create catalog '$CATALOG' (HTTP $resp): $body"
      echo "      Will continue with auto-detected catalogs only."
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
# Note: avoid bash associative array here (older bash on macOS can choke on
# combined .env source + declare -A). Use simple variables instead.
BRONZE_VOL="${DATABRICKS_BRONZE_VOLUME:-bronze_data}"
SILVER_VOL="${DATABRICKS_SILVER_VOLUME:-silver_data}"
GOLD_VOL="${DATABRICKS_GOLD_VOLUME:-gold_data}"
CP_VOL="${DATABRICKS_CHECKPOINT_VOLUME:-checkpoints}"

create_volume() {
  local schema="$1" vol_name="$2"
  local resp body
  resp="$(req_code POST /api/2.1/unity-catalog/volumes \
    "{\"catalog_name\":\"$CATALOG\",\"schema_name\":\"$schema\",\"name\":\"$vol_name\",\"volume_type\":\"MANAGED\"}")"
  body="$(cat /tmp/_bs.json)"
  case "$resp" in
    200) echo "  ✅ Created volume $CATALOG.$schema.$vol_name" ;;
    409) echo "  ✓  $CATALOG.$schema.$vol_name already exists" ;;
    400)
      if echo "$body" | grep -qi "already.*exists\|volume.*exists\|RESOURCE_ALREADY_EXISTS"; then
        echo "  ✓  $CATALOG.$schema.$vol_name already exists"
      else
        echo "  ❌ Failed to create $schema.$vol_name (HTTP $resp): $body"
      fi
      ;;
    *) echo "  ❌ Failed to create $schema.$vol_name (HTTP $resp): $body" ;;
  esac
}

# 3a. Per-layer data volumes
for layer in bronze silver gold; do
  case "$layer" in
    bronze) vol="$BRONZE_VOL" ;;
    silver) vol="$SILVER_VOL" ;;
    gold)   vol="$GOLD_VOL" ;;
  esac
  create_volume "$layer" "$vol"
done

# 3b. Checkpoint volume (lives under bronze schema as a convention)
create_volume "bronze" "$CP_VOL"

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
WRITE_PATH="/Volumes/$CATALOG/bronze/${BRONZE_VOL}/$SMOKE_FILE"
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
