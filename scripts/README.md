# Pipeline and utility scripts

Python pipeline implementations live in `src/lakehouse/`; this directory
contains the supported shell entry points and project utilities.

## Retail batch pipeline

Start Docker services with `make up`, then run the end-to-end batch flow:

```bash
bash scripts/run_batch_pipeline.sh --pipeline batch_retail
```

The pipeline reads sample inputs, writes Delta tables through the Bronze,
Silver, and Gold layers, and stores local Delta data in MinIO. Individual
stages can be run with `--pipeline bronze`, `--pipeline silver`, or
`--pipeline gold`.

## Metabase reporting mirror

Metabase cannot query Delta directly from MinIO. After the batch pipeline
finishes, mirror the curated Gold Delta tables into the local PostgreSQL
reporting database:

```bash
bash scripts/sync_gold_to_metabase.sh
```

The script reads `fact_orders`, `daily_revenue`, `dim_customers`, and
`dim_products` from the MinIO Gold bucket and replaces their corresponding
tables in `gold_analytics`. MinIO remains the source of truth. Run the sync
again after Gold changes.

See [`../docs/operations/DEV_LINKS.md`](../docs/operations/DEV_LINKS.md#hiển-thị-gold-trên-metabase)
for the Metabase PostgreSQL connection fields.

## Other utilities

- `check_dev_links.sh` — check local service URLs.
- `verify.sh` — validate repository prerequisites and configuration.
- `verify_phase3.sh` — verify local batch pipeline layers and tables.
- `run_all.sh` — Databricks ETL/ELT demonstration; separate from local MinIO batch flow.
- `_legacy/` — retired scripts kept for historical reference.

Use `bash scripts/<name>.sh --help` where supported; check the script header
for prerequisites and options.
