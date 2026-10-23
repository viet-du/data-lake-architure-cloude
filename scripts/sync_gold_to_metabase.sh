#!/usr/bin/env bash
set -euo pipefail

SPARK_CONTAINER="lake-spark-master"
SCRIPT_PATH="/app-src/src/lakehouse/tools/sync_gold_to_postgres.py"
POSTGRES_PACKAGE="org.postgresql:postgresql:42.7.4"

if ! docker ps --format '{{.Names}}' | grep -qx "$SPARK_CONTAINER"; then
    echo "Spark container is not running. Start the core stack first (make up)." >&2
    exit 2
fi

echo "Mirroring Gold Delta tables from MinIO into gold_analytics PostgreSQL..."
docker exec \
    -e HOME=/tmp \
    -e PYTHONPATH=/app-src/src \
    -e PYSPARK_PYTHON=python3 \
    "$SPARK_CONTAINER" \
    spark-submit \
    --master 'local[*]' \
    --packages "$POSTGRES_PACKAGE" \
    --conf "spark.jars.ivy=/tmp/.ivy2" \
    --conf "spark.pyspark.python=python3" \
    "$SCRIPT_PATH"

echo "Gold tables are ready for Metabase."
