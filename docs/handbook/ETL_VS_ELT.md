# ETL vs ELT: Paradigm Comparison

> **TL;DR:** Both produce identical data (10/17/10 rows match, top-3 LTV match).
> Choose based on data volume, transform complexity, and consumer.

---

## What we built

Two pipelines sharing the same input and same logical output:

### Pipeline A — ETL (Extract → Transform → Load)

```
[CSV] → read_files() → pandas (dedup, validate, join, agg)
     → VALUES literal → [Delta clean silver/gold]
```

**Run:** `python scripts/_etl_pipeline.py`
**Outputs:** `workspace.silver.customers_clean_etl`, `orders_enriched_etl`, `gold.customer_ltv_etl`

### Pipeline B — ELT (Extract → Load → Transform)

```
[CSV] → read_files() → [Delta raw landing]
     → SQL CREATE AS SELECT → [Delta silver]
     → SQL CREATE AS SELECT → [Delta gold]
```

**Run:** `python scripts/_elt_pipeline.py`
**Outputs:** `raw_elt.customers_raw/orders_raw`, `silver.*_elt`, `gold.customer_ltv_elt`

---

## Decision matrix

| Criterion | ETL | ELT |
|---|:---:|:---:|
| Data fits in RAM (≤ 1M rows) | ✅ | ✅ |
| Data is large (> 1M rows, streaming) | ❌ | ✅ |
| Complex Python libs (sklearn, spaCy, custom ML) | ✅ | ❌ |
| SQL-only transforms | ✅ | ✅ |
| Schema evolution / late binding | ❌ | ✅ |
| Business users query raw layer | ❌ | ✅ |
| Strict PII masking before lake | ✅ | ❌ |
| Lowest data movement (compute next to data) | ❌ | ✅ |
| Reproducible / version-controlled transformations | ✅ (Python) | ✅ (SQL) |
| One source of truth for clean logic | ❌ (per pipeline) | ✅ (raw is canonical) |

---

## Recommended hybrid architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     INGEST (always ELT)                          │
│   R2 / Kafka / API → raw_elt schema (verbatim, append-only)      │
│   • Audit trail: what came in, when, from where                 │
│   • Reprocessing: re-run silver/gold without re-ingest           │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
   ┌──────────────────────────┐  ┌────────────────────────────┐
│  TRANSFORM (mostly ELT)  │  │  ML FEATURES (ETL)         │
│  SQL on raw_elt → silver │  │  pandas/sklearn → feature  │
│  SQL on silver  → gold   │  │  store (small)             │
│                          │  │                            │
│  • Aggregation, dedup,   │  │  • Custom embeddings,      │
│    validation, joins     │  │    time-series features,   │
│  • Unity Catalog ACLs    │  │    PII tokenisation        │
└──────────────────────────┘  └────────────────────────────┘
```

---

## Verdict

For the current dataset (27 rows, 2 CSVs), **both work and are correct**.

- **ETL:** ~35s total. Wins when you need Python libs.
- **ELT:** ~37s total. Wins as data grows (warehouse scales without code changes).

For new features in this project, **use ELT** (`*_elt` tables). We keep ETL only for the comparison artifact.

---

## Reproduce

```bash
bash scripts/run_all.sh                       # ETL + ELT
python scripts/_compare_etl_elt.py            # comparison report
```

Or step-by-step:

```bash
python scripts/_etl_pipeline.py
python scripts/_elt_pipeline.py
python scripts/_compare_etl_elt.py
```

---

## Sample comparison report (2026-10-19)

```
⏱  ETL total: 35.6s
⏱  ELT total: 37.2s

Row counts:
  silver.customers_clean   ETL=10  ELT=10  ✅
  silver.orders_enriched   ETL=17  ELT=17  ✅
  gold.customer_ltv        ETL=10  ELT=10  ✅

Top-3 by LTV (both pipelines):
  1. Carol Le   — $17,500
  2. Henry Ly   —  $7,700
  3. Bob Tran   —  $3,290
```
