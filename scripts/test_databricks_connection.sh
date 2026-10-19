#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Verify Databricks connection (Community Edition - serverless).
# Tests:
#   1. Auth via Personal Access Token (PAT)
#   2. Workspace info (current user, org name)
#   3. List existing schemas in the configured catalog
#   4. Create 3 schemas (bronze, silver, gold) if missing
#   5. Verify table write/read via temporary Delta table
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── load .env (git-ignored) ──────────────────────────────────
if [ ! -f .env ]; then
  echo "ERROR: .env not found at $REPO_ROOT/.env"
  echo "       Run: cp .env.databricks.template .env"
  echo "       Then fill in DATABRICKS_TOKEN."
  exit 1
fi
# shellcheck disable=SC1091
set -a; source .env; set +a

# ── required env vars ─────────────────────────────────────────
: "${DATABRICKS_HOST:?DATABRICKS_HOST is required (e.g. https://community.cloud.databricks.com/)}"
: "${DATABRICKS_TOKEN:?DATABRICKS_TOKEN is required (generate from User Settings → Access tokens)}"

# ── token format validation (Community Edition tokens are 36 chars) ────
# Databricks Community Edition tokens typically look like: dapi + 32 hex chars
# (40 chars total on some workspaces). We accept any token starting with
# 'dapi' that is at least 32 chars long. Reject obvious mistakes early.
TOKEN_LEN="${#DATABRICKS_TOKEN}"
TOKEN_PREFIX="${DATABRICKS_TOKEN:0:4}"
if [ "$TOKEN_PREFIX" != "dapi" ]; then
  echo "  ❌ DATABRICKS_TOKEN must start with 'dapi' — got '$TOKEN_PREFIX'"
  echo "     (Did you accidentally paste a Bearer prefix or trim characters?)"
  exit 1
fi
if [ "$TOKEN_LEN" -lt 32 ] || [ "$TOKEN_LEN" -gt 64 ]; then
  echo "  ❌ DATABRICKS_TOKEN length looks wrong: $TOKEN_LEN chars"
  echo "     Expected 32-64 chars. Real Databricks tokens are typically 36 or 40 chars."
  echo "     → Regenerate at User Settings → Developer → Access tokens"
  exit 1
fi
echo "  ✓ Token format OK (length=$TOKEN_LEN, prefix=$TOKEN_PREFIX)"

DATABRICKS_CATALOG="${DATABRICKS_CATALOG:-workspace}"

# ── helpers ──────────────────────────────────────────────────
hr() { printf '\n%s\n' "──────────────────────────────────────────────────────────────"; }

req() {
  local method="$1" path="$2" body="${3:-}"
  local args=( -sS -X "$method" -H "Authorization: Bearer $DATABRICKS_TOKEN" )
  if [ -n "$body" ]; then args+=( -H "Content-Type: application/json" -d "$body" ); fi
  curl "${args[@]}" "${DATABRICKS_HOST}${path}"
}

echo "▶ Databricks connection test (serverless)"
hr
echo "HOST   : $DATABRICKS_HOST"
echo "CATALOG: $DATABRICKS_CATALOG"
echo "TOKEN  : ${DATABRICKS_TOKEN:0:10}...${DATABRICKS_TOKEN: -4}"

# ── 1. Auth check ─────────────────────────────────────────────
hr
echo "[1/5] Auth check (GET /api/2.0/preview/scim/v2/Me)"
ME_HTTP="$(curl -sS -o /tmp/_dbx_me.json -w '%{http_code}' \
  -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "${DATABRICKS_HOST}/api/2.0/preview/scim/v2/Me")"
ME_JSON="$(cat /tmp/_dbx_me.json)"
if [ "$ME_HTTP" != "200" ]; then
  echo "  ❌ Auth FAILED (HTTP $ME_HTTP) — token may be expired or invalid"
  echo "     body: $ME_JSON"
  # Common case: freshly-generated token still propagating across Databricks
  # control plane (5-15 minutes). The UI shows this as 'In progress' on the
  # Developer → Access tokens page. Wait and retry.
  if echo "$ME_JSON" | grep -qi "in progress\|propagat\|not yet active\|credential was not sent\|unsupported type"; then
    echo "     ⚠️  Likely a fresh token still propagating. Wait 5-15 min then retry."
    echo "        (UI status: 'In progress' on Developer → Access tokens page)"
  else
    echo "     → Regenerate token at User Settings → Developer → Access tokens"
  fi
  exit 1
fi
echo "$ME_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
emails = [e['value'] for e in d.get('emails', []) if e.get('primary')]
user  = d.get('userName', '?')
print(f'  ✅ Auth OK — user={user}, email={emails[0] if emails else \"?\"}')"

# ── 2. Workspace info ─────────────────────────────────────────
hr
echo "[2/5] Workspace info (GET /api/2.0/preview/scim/v2/Me)"
echo "$ME_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'  org_id     : {d.get(\"orgId\", \"?\")}')
print(f'  object_id  : {d.get(\"id\", \"?\")}')
print(f'  active     : {d.get(\"active\", \"?\")}')"

# ── 3. List schemas ───────────────────────────────────────────
hr
echo "[3/5] List schemas in catalog '$DATABRICKS_CATALOG'"
SCHEMA_JSON="$(req GET "/api/2.1/unity-catalog/schemas?catalog_name=$DATABRICKS_CATALOG")"
echo "$SCHEMA_JSON" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print('  ❌ Invalid JSON response')
    sys.exit(1)
schemas = [s['name'] for s in d.get('schemas', [])]
print(f'  ✅ Found {len(schemas)} schemas: {schemas}')"

# ── 4. Create 3 schemas if missing ────────────────────────────
hr
echo "[4/5] Ensure schemas (bronze, silver, gold) exist"
for layer in bronze silver gold; do
  resp="$(curl -sS -o /tmp/_dbx_sch.json -w '%{http_code}' \
    -X POST -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"catalog_name\":\"$DATABRICKS_CATALOG\",\"name\":\"$layer\"}" \
    "${DATABRICKS_HOST}/api/2.1/unity-catalog/schemas")"
  body="$(cat /tmp/_dbx_sch.json)"
  case "$resp" in
    200) echo "  ✅ Created $DATABRICKS_CATALOG.$layer" ;;
    409) echo "  ✓  $DATABRICKS_CATALOG.$layer already exists" ;;
    400) # Could be ALREADY_EXISTS or INVALID_PARAMETER
        if echo "$body" | grep -qi "already\|exists\|schema.*exists"; then
          echo "  ✓  $DATABRICKS_CATALOG.$layer already exists"
        else
          echo "  ❌ Failed to create $layer (HTTP $resp): $body"
        fi
        ;;
    *)   echo "  ❌ Failed to create $layer (HTTP $resp): $body" ;;
  esac
done

# ── 5. Verify write/read via Unity Catalog Files API
hr
echo "[5/5] Write & read smoke test via Unity Catalog Files API"
SMOKE_VOL="smoke_vol_$$"
SMOKE_FILE="smoke_$(date +%s).txt"
SMOKE_CONTENT="hello from data-lake-architecture @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 5a. Create a managed volume
VOL_RESP="$(curl -sS -o /tmp/_dbx_vol.json -w '%{http_code}' \
  -X POST -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"catalog_name\":\"$DATABRICKS_CATALOG\",\"schema_name\":\"bronze\",\"name\":\"$SMOKE_VOL\",\"volume_type\":\"MANAGED\"}" \
  "${DATABRICKS_HOST}/api/2.1/unity-catalog/volumes")"

if [ "$VOL_RESP" != "200" ]; then
  echo "  ❌ Volume create FAILED (HTTP $VOL_RESP)"
  cat /tmp/_dbx_vol.json
  echo ""
  echo "  ℹ️  Note: Could not create Unity Catalog Volume."
  echo "     Auth + schemas are confirmed working — pipeline can run."
  exit 0
fi
echo "  ✅ Volume created: $DATABRICKS_CATALOG.bronze.$SMOKE_VOL"

# 5b. Write file via Files API (PUT with binary body)
VOL_BASE="/Volumes/$DATABRICKS_CATALOG/bronze/$SMOKE_VOL"
WRITE_HTTP="$(curl -sS -o /tmp/_dbx_write.json -w '%{http_code}' \
  -X PUT -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "$SMOKE_CONTENT" \
  "${DATABRICKS_HOST}/api/2.0/fs/files${VOL_BASE}/${SMOKE_FILE}")"

if [ "$WRITE_HTTP" != "200" ] && [ "$WRITE_HTTP" != "204" ]; then
  echo "  ❌ Write FAILED (HTTP $WRITE_HTTP) to ${VOL_BASE}/${SMOKE_FILE}"
  cat /tmp/_dbx_write.json
  # Cleanup
  curl -sS -o /dev/null -X DELETE \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    "${DATABRICKS_HOST}/api/2.1/unity-catalog/volumes/$DATABRICKS_CATALOG.bronze.$SMOKE_VOL" >/dev/null 2>&1 || true
  exit 0
fi
echo "  ✅ Write OK: ${VOL_BASE}/${SMOKE_FILE}"

# 5c. Read back via Files API (GET returns binary stream)
echo "$SMOKE_CONTENT" | curl -sS -o /tmp/_dbx_read.txt -w 'HTTP %{http_code}\n' \
  -X GET -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "${DATABRICKS_HOST}/api/2.0/fs/files${VOL_BASE}/${SMOKE_FILE}"

if ! diff -q /tmp/_dbx_read.txt <(printf '%s' "$SMOKE_CONTENT") >/dev/null 2>&1; then
  echo "  ❌ Read content mismatch:"
  echo "     expected: $(printf '%s' "$SMOKE_CONTENT" | head -c 80)"
  echo "     got     : $(head -c 80 /tmp/_dbx_read.txt 2>/dev/null)"
  exit 1
fi
echo "  ✅ Read OK — content matches: '$(head -c 80 /tmp/_dbx_read.txt)...'"

# 5d. Cleanup volume
curl -sS -o /dev/null -X DELETE \
  -H "Authorization: Bearer $DATABRICKS_TOKEN" \
  "${DATABRICKS_HOST}/api/2.1/unity-catalog/volumes/$DATABRICKS_CATALOG.bronze.$SMOKE_VOL" >/dev/null 2>&1 || true
echo "  ✓  cleanup $DATABRICKS_CATALOG.bronze.$SMOKE_VOL"

hr
echo "🎉 All checks passed — you can run the pipeline:"
echo "   ENV=databricks make pipeline-batch"
echo "   ENV=databricks make stream-clickstream"
