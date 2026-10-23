#!/usr/bin/env bash
# ============================================================================
# Verify Delta data in MinIO (bronze / silver / gold).
#
# Usage:
#   bash scripts/verify_lake_data.sh
#   bash scripts/verify_lake_data.sh --layer gold
#   bash scripts/verify_lake_data.sh --table fact_orders
# ============================================================================

set -euo pipefail

LAYER=""
TABLE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --layer)  LAYER="$2"; shift 2 ;;
        --table)  TABLE="$2"; shift 2 ;;
        *)        echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

if ! docker ps --format '{{.Names}}' | grep -q '^lake-minio$'; then
    echo "❌ lake-minio container not running. Start with: make up" >&2
    exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -q '^lake-spark-master$'; then
    echo "❌ lake-spark-master container not running. Start with: make up" >&2
    exit 1
fi

docker exec lake-minio mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1

echo "═══════════════════════════════════════════════════════════════"
echo "  MinIO Data Lake — Verification"
echo "═══════════════════════════════════════════════════════════════"

if [[ -n "$LAYER" ]]; then
    LAYERS=("$LAYER")
else
    LAYERS=(bronze silver gold)
fi

for layer in "${LAYERS[@]}"; do
    echo ""
    echo "─── Layer: $layer ────────────────────────────────────────"
    # sed consumes the full listing but prints only 20 lines. `head -20` exits
    # early, can SIGPIPE `mc`, and with pipefail makes a populated bucket look empty.
    if LISTING=$(docker exec lake-minio mc ls --recursive "local/$layer/" 2>&1 | sed -n '1,20p'); then
        if [[ -n "$LISTING" ]]; then
            printf '%s\n' "$LISTING"
        else
            echo "  (empty)"
        fi
    else
        echo "❌ Could not list local/$layer/:" >&2
        printf '%s\n' "$LISTING" >&2
        exit 1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Delta table row counts (each table checked separately)"
echo "═══════════════════════════════════════════════════════════════"

SPARK_ARGS=(--layers "${LAYERS[@]}")
if [[ -n "$TABLE" ]]; then
    SPARK_ARGS+=(--table "$TABLE")
fi

docker exec lake-spark-master spark-submit \
    --master 'local[1]' \
    --driver-memory 512m \
    --conf spark.executor.memory=512m \
    --packages io.delta:delta-spark_2.12:3.0.0,org.apache.hadoop:hadoop-aws:3.3.4,com.amazonaws:aws-java-sdk-bundle:1.12.262 \
    /app-src/src/lakehouse/tools/verify_minio_delta.py \
    "${SPARK_ARGS[@]}"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "  Spark UI:      http://localhost:8080"
echo "═══════════════════════════════════════════════════════════════"
