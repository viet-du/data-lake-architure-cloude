#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Debug what APIs Community Edition actually supports.
# Prints RAW response (no parsing) for each candidate endpoint.
# ═══════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")/.."
set -a; source .env; set +a

: "${DATABRICKS_HOST:?missing}"; : "${DATABRICKS_TOKEN:?missing}"

call() {
  local label="$1" method="$2" path="$3"
  echo
  echo "▶ $label"
  echo "  $method $path"
  local code
  code=$(curl -sS -o /tmp/_dbx_resp.txt -w '%{http_code}' \
    -X "$method" \
    -H "Authorization: Bearer $DATABRICKS_TOKEN" \
    -H "Content-Type: application/json" \
    "${DATABRICKS_HOST}${path}")
  echo "  HTTP $code"
  echo "  body (first 400 chars):"
  head -c 400 /tmp/_dbx_resp.txt | sed 's/^/    /'
  echo
}

call "Me (SCIM v2)"              GET  "/api/2.0/preview/scim/v2/Me"
call "Current user (Databricks)" GET  "/api/2.0/preview/scim/v2/Me"
call "Clusters list"             GET  "/api/2.0/dbclusters/list"
call "SQL Warehouses"            GET  "/api/2.0/sql/warehouses"
call "SQL Endpoints"             GET  "/api/2.0/sql/endpoints"
call "Unity Catalog catalogs"    GET  "/api/2.1/unity-catalog/catalogs"
call "Workspace files (DBFS root status)" GET "/api/2.0/dbfs/get-status?path=dbfs:/"
call "Workspace info"            GET  "/api/2.0/preview/workspace/list?path=/"
