#!/bin/sh
# Temporary E2E harness for the Phase 1.9 acceptance run.
# Each job is submitted through the exact JSON protocol the TypeScript
# BullMQ worker uses (`python -m lakehouse.jobs.runner '<payload>'`).
run() {
  python -m lakehouse.jobs.runner "{\"operation\":\"$1\",\"jobId\":\"$2\",\"params\":$3}" 2>&1 | tail -2
}

case "$1" in
  bronze)
    run bronze.ingest_json p1-9-br-erp-orders   "{\"source\":\"file:///data-samples/erp/orders.json\",\"database\":\"erp\",\"table\":\"orders\"}"
    run bronze.ingest_csv  p1-9-br-crm-customers "{\"source\":\"file:///data-samples/crm/customers.csv\",\"database\":\"crm\",\"table\":\"customers\"}"
    run bronze.ingest_csv  p1-9-br-erp-products  "{\"source\":\"file:///data-samples/erp/products.csv\",\"database\":\"erp\",\"table\":\"products\"}"
    ;;
  silver)
    run silver.transform p1-9-si-erp-orders    "{\"targetTable\":\"orders\",\"database\":\"erp\"}"
    run silver.transform p1-9-si-crm-customers "{\"targetTable\":\"customers\",\"database\":\"crm\"}"
    run silver.transform p1-9-si-erp-products  "{\"targetTable\":\"products\",\"database\":\"erp\"}"
    ;;
  gold)
    run gold.aggregate p1-9-gd-fact-orders   "{\"targetTable\":\"fact_orders\",\"database\":\"retail\"}"
    run gold.aggregate p1-9-gd-dim-customers "{\"targetTable\":\"dim_customers\",\"database\":\"retail\"}"
    run gold.aggregate p1-9-gd-dim-products  "{\"targetTable\":\"dim_products\",\"database\":\"retail\"}"
    run gold.aggregate p1-9-gd-daily-revenue "{\"targetTable\":\"daily_revenue\",\"database\":\"retail\"}"
    ;;
  *)
    echo "usage: $0 bronze|silver|gold" >&2
    exit 2
    ;;
esac
