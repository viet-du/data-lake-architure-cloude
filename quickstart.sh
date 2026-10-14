#!/usr/bin/env bash
# ============================================================================
# quickstart.sh
# ----------------------------------------------------------------------------
# One-shot setup: bring everything up, populate mock data, run all pipelines.
#
# Idempotent: safe to re-run. Each step skips if already done.
#
# Steps:
#   1. Install Python deps
#   2. Start Docker stack (Postgres, Kafka, Spark, Airflow, MinIO, etc.)
#   3. Wait for health
#   4. Generate mock data (customers, products, orders)
#   5. Ingest to Bronze
#   6. Transform to Silver
#   7. Aggregate to Gold
#   8. Run a sample Tiki crawl (smoke test crawler)
#   9. Print status of all UIs
#
# Usage:
#   bash quickstart.sh
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

step() { echo -e "\n${YELLOW}▶ $*${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }

# -----------------------------------------------------------------
# Step 0: Pre-flight
# -----------------------------------------------------------------
step "0/9  Pre-flight checks"
command -v docker >/dev/null 2>&1 || fail "Docker not installed"
command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null \
    && docker compose version >/dev/null 2>&1 || fail "docker-compose not available"
ok "Docker available"

# -----------------------------------------------------------------
# Step 1: Python deps
# -----------------------------------------------------------------
step "1/9  Installing Python dependencies"
if [[ -d .venv ]]; then
    .venv/bin/python -c "import delta, pyspark, kafka, requests" 2>/dev/null && ok "Venv already set up" || {
        ok "Upgrading venv with missing packages"
        .venv/bin/pip install --quiet pandas pyarrow boto3 pyspark delta-spark kafka-python requests 2>&1 | tail -3
    }
else
    python3 -m venv .venv
    .venv/bin/pip install --quiet --upgrade pip
    .venv/bin/pip install --quiet -e ".[dev]" 2>&1 | tail -3
    ok "Created venv + installed package"
fi

# -----------------------------------------------------------------
# Step 2: Docker stack
# -----------------------------------------------------------------
step "2/9  Starting Docker stack (Postgres, Kafka, Spark, Airflow, MinIO, ...)"
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.spark.yml up -d 2>&1 | tail -5
ok "Containers started"

# -----------------------------------------------------------------
# Step 3: Wait for health
# -----------------------------------------------------------------
step "3/9  Waiting for services to become healthy (max 120s)"
for i in {1..24}; do
    POSTGRES_OK=$(docker ps --filter "name=lake-postgres" --filter "health=healthy" -q | head -1)
    KAFKA_OK=$(docker ps --filter "name=lake-kafka" --filter "health=healthy" -q | head -1)
    SPARK_OK=$(docker ps --filter "name=lake-spark-master" --filter "health=healthy" -q | head -1)
    if [[ -n "$POSTGRES_OK" && -n "$KAFKA_OK" && -n "$SPARK_OK" ]]; then
        ok "All core services healthy (took ${i}*5s)"
        break
    fi
    sleep 5
    if [[ $i -eq 24 ]]; then
        fail "Services didn't become healthy in 120s. Run 'docker ps' to check."
    fi
done

# -----------------------------------------------------------------
# Step 4: Generate mock data
# -----------------------------------------------------------------
step "4/9  Generating mock retail data (500 customers, 100 products, 2000 orders)"
if [[ -f data-samples/crm/customers.csv && -f data-samples/erp/products.csv && -f data-samples/erp/orders.json ]]; then
    ok "Mock data already exists (skipping)"
else
    .venv/bin/python -m lakehouse.sources.mock.retail_generator 2>&1 | tail -5
fi

# -----------------------------------------------------------------
# Step 5: Bronze (ingest CSV/JSON → Delta)
# -----------------------------------------------------------------
step "5/9  Ingesting to Bronze layer (Delta tables in MinIO)"
bash scripts/run_batch_pipeline.sh --pipeline bronze 2>&1 | tail -10 \
    || fail "Bronze ingest failed"

# -----------------------------------------------------------------
# Step 6: Silver (clean + transform)
# -----------------------------------------------------------------
step "6/9  Transforming to Silver layer (dedup, type-cast, enrich)"
bash scripts/run_batch_pipeline.sh --pipeline silver 2>&1 | tail -10 \
    || fail "Silver transform failed"

# -----------------------------------------------------------------
# Step 7: Gold (aggregate)
# -----------------------------------------------------------------
step "7/9  Aggregating to Gold layer (fact_orders, dim_*, daily_revenue)"
bash scripts/run_batch_pipeline.sh --pipeline gold 2>&1 | tail -10 \
    || fail "Gold aggregate failed"

# -----------------------------------------------------------------
# Step 8: Smoke test crawler
# -----------------------------------------------------------------
step "8/9  Smoke-testing Tiki crawler (1 page, smartphone category)"
.venv/bin/python -c "
from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler
crawler = TikiCrawler()
items = crawler.crawl(category='smartphone', max_pages=1, workers=1)
print(f'  Crawled {len(items)} smartphone products from Tiki')
" 2>&1 | tail -3

# -----------------------------------------------------------------
# Step 9: Print UI status
# -----------------------------------------------------------------
step "9/9  All done!"
cat <<EOF

  ┌──────────────────────────────────────────────────────────────┐
  │  OPEN IN BROWSER                                              │
  ├──────────────────────────────────────────────────────────────┤
  │  • Spark Master:     http://localhost:8080                    │
  │  • Spark Worker UI:  http://localhost:4040                    │
  │  • MinIO Console:    http://localhost:9001 (minio/minio123)   │
  │  • Airflow UI:       http://localhost:8088 (airflow/airflow)  │
  │  • Kafka UI:         http://localhost:8081                    │
  │  • Redpanda Console: http://localhost:8091                    │
  │  • Metabase:         http://localhost:3000                    │
  │  • Hive Metastore:   http://localhost:9083                    │
  │  • API (after dev):  http://localhost:3001                    │
  │  • Web (after dev):  http://localhost:5173                    │
  └──────────────────────────────────────────────────────────────┘

  NEXT STEPS:

    • Trigger ETL DAG in Airflow:    make airflow-trigger
    • Start crawl scheduler:         make scheduler-daemon
    • Run all tests:                 make verify
    • Develop API locally:           bash scripts/dev-api.sh
    • Develop Web locally:           bash scripts/dev-web.sh

  STOP:

    • Stop scheduler:                make scheduler-stop
    • Stop all infra:                make down
EOF
