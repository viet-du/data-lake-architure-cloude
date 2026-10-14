#!/usr/bin/env bash
# ============================================================================
# scripts/verify_lake_data.sh
# ----------------------------------------------------------------------------
# Verify that data exists in MinIO at each layer (bronze / silver / gold).
# Reports row counts and schema summary for each Delta table.
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

# Ensure alias is set
docker exec lake-minio mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1

echo "═══════════════════════════════════════════════════════════════"
echo "  MinIO Data Lake — Verification"
echo "═══════════════════════════════════════════════════════════════"

LAYERS=("${LAYER:-bronze}" "${LAYER:-silver}" "${LAYER:-gold}")

for layer in "${LAYERS[@]}"; do
    echo ""
    echo "─── Layer: $layer ────────────────────────────────────────"
    docker exec lake-minio mc ls --recursive "local/$layer/" 2>/dev/null | head -20 || echo "  (empty)"

    if docker exec lake-minio mc ls "local/$layer/" >/dev/null 2>&1; then
        TOTAL_SIZE=$(docker exec lake-minio mc du --recursive "local/$layer/" 2>/dev/null | tail -1 | awk '{print $1, $2}')
        echo "  Total size: $TOTAL_SIZE"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Spark Delta tables (row counts via spark-submit)"
echo "═══════════════════════════════════════════════════════════════"

# Run a quick Python script via spark-submit to count rows
docker exec lake-spark-master bash -c '
export HOME=/tmp
export PYTHONPATH=/app-src/src:/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.7-src.zip
export PYSPARK_PYTHON=python3

python3 -c "
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName(\"verify\").master(\"spark://spark-master:7077\").getOrCreate()

# MinIO config
spark._jsc.hadoopConfiguration().set(\"fs.s3a.endpoint\", \"http://minio:9000\")
spark._jsc.hadoopConfiguration().set(\"fs.s3a.access.key\", \"minioadmin\")
spark._jsc.hadoopConfiguration().set(\"fs.s3a.secret.key\", \"minioadmin\")
spark._jsc.hadoopConfiguration().set(\"fs.s3a.path.style.access\", \"true\")

# Try to read all delta tables
layers = [\"bronze\", \"silver\", \"gold\"]
for layer in layers:
    print(f\"\\n=== {layer.upper()} ===\")
    try:
        # List objects at prefix
        df = spark.read.format(\"delta\").load(f\"s3a://{layer}/\")
        # Show only top-level tables (not subdirs)
        # (Delta automatically picks up partitioned tables)
        cnt = df.count()
        print(f\"  Total rows in s3a://{layer}/: {cnt}\")
        if cnt > 0:
            print(f\"  Schema:\")
            df.printSchema()
    except Exception as e:
        print(f\"  (no data or error: {type(e).__name__})\")
spark.stop()
"
' 2>&1 | grep -v "WARN\|INFO\|SLF4J" | head -50

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "  Spark UI:      http://localhost:8080"
echo "═══════════════════════════════════════════════════════════════"
