#!/usr/bin/env bash
# ============================================================================
# scripts/run_batch_pipeline.sh
# ----------------------------------------------------------------------------
# Run the batch retail ETL pipeline (Bronze → Silver → Gold) via spark-submit
# inside the lake-spark-master container.
#
# Why this wrapper exists:
#   - `apache/spark:3.5.0` is built standalone, not via bitnami, so we need
#     to set PYTHONPATH, HOME, Ivy cache dir explicitly
#   - We pre-include hadoop-aws and aws-java-sdk-bundle for S3A support
#     (apache/spark image ships without Hadoop client libraries)
#   - delta-spark pip package is installed in custom image lake-spark:3.5.0
#     (built from Dockerfile.spark) so configure_spark_with_delta_pip works
#
# Prerequisites:
#   - Stack running: docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.spark.yml up -d
#   - lake-spark-master healthy
#   - MinIO has buckets: bronze, silver, gold (auto-created by lake-minio-init)
#   - Source data present: data-samples/crm/customers.csv, data-samples/erp/*.csv, data-samples/erp/*.json
#
# Usage:
#   bash scripts/run_batch_pipeline.sh
#   bash scripts/run_batch_pipeline.sh --pipeline streaming
#   bash scripts/run_batch_pipeline.sh --dry-run
# ============================================================================

set -euo pipefail

PIPELINE="batch_retail"
DRY_RUN=0
MASTER_URL="spark://spark-master:7077"
SPARK_CONTAINER="lake-spark-master"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pipeline) PIPELINE="$2"; shift 2 ;;
        --dry-run)  DRY_RUN=1; shift ;;
        --master)   MASTER_URL="$2"; shift 2 ;;
        --container) SPARK_CONTAINER="$2"; shift 2 ;;
        -h|--help)
            head -20 "$0"
            exit 0
            ;;
        *) echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

# Pipeline file mapping
case "$PIPELINE" in
    batch_retail) PIPELINE_PATH="/app-src/src/lakehouse/pipelines/batch_retail.py" ;;
    bronze)       PIPELINE_PATH="/app-src/src/lakehouse/ingest/batch/csv_ingestor.py" ;;
    silver)       PIPELINE_PATH="/app-src/src/lakehouse/transform/batch/customers_transformer.py" ;;
    gold)         PIPELINE_PATH="/app-src/src/lakehouse/aggregate/batch/fact_orders_aggregator.py" ;;
    *) echo "Unknown pipeline: $PIPELINE (use: batch_retail, bronze, silver, gold)" >&2; exit 2 ;;
esac

# Common spark-submit config:
#   - 3 packages: delta-spark, hadoop-aws, aws-java-sdk-bundle (S3A support)
#   - Ivy cache in /tmp/.ivy2 (writable in apache/spark image)
#   - PYSPARK_PYTHON=python3 (use container's python3.8)
PACKAGES="io.delta:delta-spark_2.12:3.0.0,org.apache.hadoop:hadoop-aws:3.3.4,com.amazonaws:aws-java-sdk-bundle:1.12.262"

SPARK_CMD=(
    /opt/spark/bin/spark-submit
    --master "$MASTER_URL"
    --packages "$PACKAGES"
    --conf "spark.jars.ivy=/tmp/.ivy2"
    --conf "spark.pyspark.python=python3"
    "$PIPELINE_PATH"
)

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY RUN — would execute in container $SPARK_CONTAINER:"
    printf '  export HOME=/tmp\n'
    printf '  export PYTHONPATH=/app-src/src:/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.7-src.zip\n'
    printf '  export PYSPARK_PYTHON=python3\n'
    printf '  '
    printf '%q ' "${SPARK_CMD[@]}"
    echo
    exit 0
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  Running pipeline: $PIPELINE"
echo "  Container:        $SPARK_CONTAINER"
echo "  Master:           $MASTER_URL"
echo "  Script:           $PIPELINE_PATH"
echo "═══════════════════════════════════════════════════════════════"

docker exec \
    -e HOME=/tmp \
    -e PYTHONPATH=/app-src/src:/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.7-src.zip \
    -e PYSPARK_PYTHON=python3 \
    "$SPARK_CONTAINER" \
    "${SPARK_CMD[@]}"

EXIT_CODE=$?

if [[ "$EXIT_CODE" -eq 0 ]]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ✅ Pipeline $PIPELINE completed successfully"
    echo "  Verify data:"
    echo "    docker exec lake-minio mc ls --recursive local/bronze/"
    echo "    docker exec lake-minio mc ls --recursive local/silver/"
    echo "    docker exec lake-minio mc ls --recursive local/gold/"
    echo "  Browse in UI:  http://localhost:9001  (minioadmin/minioadmin)"
    echo "═══════════════════════════════════════════════════════════════"
else
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  ❌ Pipeline $PIPELINE failed with exit code $EXIT_CODE"
    echo "  Check logs:    docker logs $SPARK_CONTAINER"
    echo "  Spark UI:      http://localhost:8080"
    echo "═══════════════════════════════════════════════════════════════"
    exit "$EXIT_CODE"
fi
