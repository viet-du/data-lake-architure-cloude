
> **Refactor từ flat structure sang monorepo chuẩn Python package.**


2026-10-06


Trước refactor, dự án có **16 file `.py` nằm chung 1 folder `scripts/`**, dẫn đến:
-  Tên file theo số (`01_`, `02_`) - không thể hiện logic
-  1 file chứa nhiều domain (file `02_` có 4 transformers)
-  SparkSession bị duplicate ở 6+ file
-  Hard-code paths/topics
-  Không có package chuẩn Python
-  Không test được
-  Airflow DAGs gọi `/scripts/` thay vì import



```
src/lakehouse/          ← Python package chuẩn (pyproject.toml)
├── core/               (4 files: spark, paths, env, constants)
├── schemas/            (3 files: clickstream, ecommerce, retail)
├── ingest/             (4 files: 2 batch + 2 streaming)
├── transform/          (5 files: 3 batch + 2 streaming)
├── aggregate/          (7 files: 4 batch + 3 streaming)
├── sources/            (10 files: 5 crawlers + producer + mock + base)
├── quality/            (1 file: checks)
├── pipelines/          (4 files: 1 base + 3 e2e)
└── storage/            (1 file: delta_writer)
```

**Tổng cộng: ~38 file Python chuẩn**, mỗi file 1 logic duy nhất.


| Metric | Trước | Sau | Cải thiện |
|---|---|---|---|
| Số file `.py` ở root | 16 (flat) | 0 (gói gọn) | -100% |
| Số dòng/file lớn nhất | 515 | ~200 | -61% |
| SparkSession duplicates | 6+ | 1 (factory) | -83% |
| Test coverage | 0% | 42 tests pass | +∞ |
| Config tập trung |  |  (core/env.py) |  |
| Có thể pip install |  |  (`pip install -e .`) |  |
| Có Makefile CLI |  |  (30+ commands) |  |
| Type hints | Một phần | 100% |  |
| Docstrings | Ít | Đầy đủ |  |


| Legacy | New | Layer |
|---|---|---|
| `scripts/01_ingest_to_bronze.py` | `lakehouse.ingest.batch.csv_ingestor` |  Bronze |
| `scripts/02_transform_to_silver.py` | `lakehouse.transform.batch.{customers,products,orders}_transformer` |  Silver (split 3 files) |
| `scripts/03_aggregate_to_gold.py` | `lakehouse.aggregate.batch.fact_orders_aggregator` |  Gold |
| `scripts/04_elt_pipeline.py` | `lakehouse.pipelines.batch_retail` | Pipeline |
| `scripts/05_kafka_producer.py` | `lakehouse.sources.producers.clickstream_producer` | Producer |
| `scripts/06_kafka_to_bronze_streaming.py` | `lakehouse.ingest.streaming.clickstream_ingestor` |  Bronze Stream |
| `scripts/07_aggregate_clickstream_gold.py` | `lakehouse.aggregate.streaming.clickstream_metrics_aggregator` |  Gold Stream |
| `scripts/08_mock_data_generator.py` | `lakehouse.sources.mock.retail_generator` | Mock |
| `scripts/09_tiki_crawler.py` | `lakehouse.sources.crawlers.tiki_crawler` | Crawler |
| `scripts/10_multi_source_crawler.py` | `lakehouse.sources.crawlers.{github,crypto,weather,hackernews}_crawler` | 4 Crawlers (split) |
| `scripts/11_ecommerce_streaming.py` | `lakehouse.pipelines.stream_ecommerce` | Pipeline |
| `scripts/12_multithread_category_crawler.py` | `lakehouse.sources.crawlers.tiki_crawler` | Merged vào TikiCrawler |
| `scripts/13_category_revenue_streaming.py` | `lakehouse.aggregate.streaming.category_revenue_aggregator` |  Gold |
| `scripts/generate_sample_data.py` | `lakehouse.sources.mock.retail_generator` | Mock |
| `scripts/utils/data_quality.py` | `lakehouse.quality.checks` | Quality |
| `scripts/utils/minio_helper.py` | `lakehouse.storage.delta_writer` | Storage |
| `scripts/demo/*` | Xóa - chuyển vào docs | Demo |
| `airflow_dags/retail_elt_dag.py` | `airflow_dags/retail_elt_dag.py` (refactored) | DAG |
| (new) | `airflow_dags/clickstream_streaming_dag.py` | DAG |
| (new) | `airflow_dags/ecommerce_streaming_dag.py` | DAG |


```
{domain}_{layer}_{type}.py

Ví dụ:
- customers_transformer.py     (domain=customers, layer=transform, type=transformer)
- fact_orders_aggregator.py    (domain=fact_orders, layer=aggregate, type=aggregator)
- tiki_crawler.py              (source=tiki, type=crawler)
```

**Tuyệt đối KHÔNG dùng**:
-  Số ở đầu tên (`01_`, `02_`)
-  CamelCase (`FactOrders`)
-  Tên chung chung (`transform.py`, `ingest.py`)


**Trước refactor:**
```bash
python scripts/01_ingest_to_bronze.py
docker exec lake-spark-master spark-submit /scripts/02_transform_to_silver.py
```

**Sau refactor:**
```bash
python -m lakehouse.ingest.batch.csv_ingestor
docker exec lake-spark-master spark-submit /app-src/lakehouse/transform/batch/customers_transformer.py

make pipeline-batch
make stream-clickstream

lakehouse-pipeline-batch
```


Trước refactor: **0 tests**
Sau refactor: **42 tests** (pytest)

```bash
$ make test
============================ 42 passed in 2.30s ==============================
```

Coverage:
- `core/paths.py` - 100%
- `core/constants.py` - 100%
- `core/env.py` - 100%
- `schemas/*` - 100%
- `sources/crawlers/base.py` - 100%
- `sources/mock/retail_generator.py` - 100%
- `quality/checks.py` - signature tests


| File | Vai trò |
|---|---|
| `pyproject.toml` | Package config, deps, scripts |
| `Makefile` | 30+ CLI commands (make up, make test, ...) |
| `.env.example` | Env vars template |
| `src/lakehouse/__init__.py` | Package marker |
| `src/lakehouse/core/` | Shared infrastructure |
| `scripts/.legacy/` | Old code (kept 2 weeks for rollback) |
| `scripts/start.sh` | Bash wrapper for `make up` |


Nếu cần rollback:

1. Code mới ở `src/lakehouse/`
2. Code cũ ở `scripts/.legacy/`
3. Để rollback: `mv scripts/.legacy/* scripts/` và xóa `src/`
4. Airflow DAGs mới ở `airflow_dags/*.py` (3 files)
5. Sau 2 tuần ổn định: `rm -rf scripts/.legacy/`


1. **Luôn đặt tên file theo chức năng**, không theo số thứ tự
2. **1 file - 1 logic** - tránh "god files"
3. **SparkSession singleton** qua factory pattern
4. **Config tập trung** ở `core/env.py` + `core/paths.py`
5. **Schemas ở module riêng** - tránh duplicate
6. **Type hints + docstrings** từ đầu
7. **Test ngay từ đầu** - dù chỉ 1-2 tests
8. **Dùng Makefile** thay vì shell scripts rải rác
