"""
scripts/verify_phase3.sh
======================
End-to-end verification of the batch pipeline data.

Verifies data is present in each Delta layer (Bronze/Silver/Gold) and that
the new schema/business rules are in place. Designed to be run AFTER the
batch pipeline completes.

Usage:
    bash scripts/verify_phase3.sh

Exit codes:
    0 - All checks pass
    1 - Some checks failed
    2 - Stack not running
"""

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

pass() {
    pass_count=$((pass_count + 1))
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    fail_count=$((fail_count + 1))
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "═══════════════════════════════════════════════════════════════"
echo "  Phase 3 Batch Correctness — Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ------------------------------------------------------------
# 1. Check stack is running
# ------------------------------------------------------------
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^lake-minio$'; then
    fail "Stack not running. Start with: make up"
    exit 2
fi
pass "Stack is running"

# ------------------------------------------------------------
# 2. Source data exists
# ------------------------------------------------------------
CUSTOMERS_CSV="$PROJECT_ROOT/data-samples/crm/customers.csv"
PRODUCTS_CSV="$PROJECT_ROOT/data-samples/erp/products.csv"
ORDERS_JSON="$PROJECT_ROOT/data-samples/erp/orders.json"

if [[ -f "$CUSTOMERS_CSV" ]]; then
    n_customers=$(($(wc -l < "$CUSTOMERS_CSV") - 1))
    if [[ $n_customers -eq 200 ]]; then
        pass "Source: 200 customers"
    else
        fail "Source customers: got $n_customers, expected 200"
    fi
else
    fail "Source customers file missing: $CUSTOMERS_CSV"
fi

if [[ -f "$PRODUCTS_CSV" ]]; then
    n_products=$(($(wc -l < "$PRODUCTS_CSV") - 1))
    if [[ $n_products -eq 50 ]]; then
        pass "Source: 50 products"
    else
        fail "Source products: got $n_products, expected 50"
    fi
else
    fail "Source products file missing: $PRODUCTS_CSV"
fi

if [[ -f "$ORDERS_JSON" ]]; then
    n_orders=$(python3 -c "import json; print(len(json.load(open('$ORDERS_JSON'))))")
    if [[ $n_orders -eq 1000 ]]; then
        pass "Source: 1000 orders"
    else
        fail "Source orders: got $n_orders, expected 1000"
    fi
else
    fail "Source orders file missing: $ORDERS_JSON"
fi

# ------------------------------------------------------------
# 3. Check MinIO has data in each layer
# ------------------------------------------------------------
docker exec lake-minio mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1

for layer in bronze silver gold; do
    n_files=$(docker exec lake-minio mc ls --recursive "local/$layer/" 2>/dev/null | grep -c "_delta_log\|\.parquet" || echo "0")
    if [[ $n_files -gt 0 ]]; then
        pass "Layer $layer has $n_files delta files"
    else
        fail "Layer $layer is empty (run: bash scripts/run_batch_pipeline.sh)"
    fi
done

# ------------------------------------------------------------
# 4. Check Bronze layer has correct sub-paths
# ------------------------------------------------------------
for subpath in "crm/customers" "erp/products" "erp/orders"; do
    listing=$(docker exec lake-minio mc ls --recursive "local/bronze/$subpath/" 2>/dev/null || true)
    if echo "$listing" | grep -q "_delta_log"; then
        pass "Bronze path exists: $subpath"
    else
        warn "Bronze path missing: $subpath (run pipeline first)"
    fi
done

# ------------------------------------------------------------
# 5. Check Silver layer has correct tables
# ------------------------------------------------------------
for table in "customers" "products" "orders"; do
    listing=$(docker exec lake-minio mc ls --recursive "local/silver/$table/" 2>/dev/null || true)
    if echo "$listing" | grep -q "_delta_log"; then
        pass "Silver table exists: $table"
    else
        warn "Silver table missing: $table (run pipeline first)"
    fi
done

# ------------------------------------------------------------
# 6. Check Gold layer has correct tables
# ------------------------------------------------------------
for table in "fact_orders" "daily_revenue" "dim_customers" "dim_products"; do
    listing=$(docker exec lake-minio mc ls --recursive "local/gold/$table/" 2>/dev/null || true)
    if echo "$listing" | grep -q "_delta_log"; then
        pass "Gold table exists: $table"
    else
        warn "Gold table missing: $table (run pipeline first)"
    fi
done

# ------------------------------------------------------------
# 7. Run Python unit tests for Phase 3 correctness
# ------------------------------------------------------------
echo ""
echo "─── Running Phase 3 regression tests ───"
cd "$PROJECT_ROOT"
if python3 -m pytest tests/test_batch_correctness.py tests/test_pipeline_idempotency.py -q 2>&1 | tail -3; then
    pass "All Phase 3 regression tests pass"
else
    fail "Some Phase 3 regression tests failed"
fi

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Results: ${pass_count} passed, ${fail_count} failed"
echo "═══════════════════════════════════════════════════════════════"

if [[ $fail_count -eq 0 ]]; then
    echo -e "${GREEN}✅ All critical checks passed${NC}"
    echo ""
    echo "To run the batch pipeline:"
    echo "  bash scripts/run_batch_pipeline.sh"
    echo ""
    echo "To re-verify after running the pipeline:"
    echo "  bash scripts/verify_phase3.sh"
    exit 0
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Start stack:    make up"
    echo "  - Run pipeline:   bash scripts/run_batch_pipeline.sh"
    echo "  - Run tests:      python3 -m pytest tests/test_batch_correctness.py -v"
    exit 1
fi
