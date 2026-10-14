# End-to-End Runbook — Chạy Pipeline Thật

> **Mục đích:** Hướng dẫn từng bước để có **data thật trong MinIO** (Bronze/Silver/Gold) từ mock data, kiểm tra trên UI.

---

## 0. Yêu cầu trước

```bash
# 1. Toolchain
brew install openjdk@17   # Java cho PySpark (local)
# Hoặc dùng Java trong Docker (không cần cài local)

# 2. Source code
git clone <repo>
cd data-lake-architecture

# 3. Python deps
make install

# 4. Docker images (chỉ lần đầu)
docker build -f Dockerfile.spark -t lake-spark:3.5.0 .
```

## 1. Khởi động stack

```bash
# Start core stack + Kafka + custom Spark
docker compose \
  -f docker-compose.yml \
  -f docker-compose-kafka.yml \
  -f docker-compose.spark.yml \
  up -d

# Đợi healthy (~60-90s)
sleep 60
make health
```

Kết quả mong đợi:
```
─── storage ───
  ✓ minio-api  (200)  MinIO S3 API  [REQUIRED]
  ✓ minio-console  (200)  MinIO Web Console
  ✓ spark-master  (200)  Spark Master UI

─── streaming ───
  ✓ kafka-broker  (open)  Kafka broker (port only)
  ✓ kafka-ui  (200)  Confluent Kafka UI
  ✓ redpanda-console  (200)  Redpanda Console

─── orchestration ───
  ✓ airflow  (200)  Airflow webserver
```

## 2. Tạo buckets trong MinIO (nếu chưa có)

Buckets tự động tạo khi `lake-minio-init` chạy. Nếu fail (do Bitnami image flag issue), tạo thủ công:

```bash
docker exec lake-minio sh -c '
mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1
for b in bronze silver gold; do
  mc mb local/$b 2>/dev/null || true
done
for layer in bronze silver gold; do
  for sub in clickstream ecommerce; do
    mc mb local/$layer/$sub 2>/dev/null || true
  done
done
mc ls local/
'
```

Kết quả: 9 buckets
```
bronze/  silver/  gold/
```

## 3. Generate mock data (nếu cần)

```bash
# Tạo 10k customers, 1k products, 50k orders
make mock-retail
# → files: data-samples/crm/customers.csv, data-samples/erp/{products,orders}.json
```

## 4. Chạy batch pipeline (Bronze → Silver → Gold)

```bash
make pipeline-batch
# hoặc
bash scripts/run_batch_pipeline.sh --pipeline batch_retail
```

Pipeline sẽ chạy 9 stages:
1. `bronze.ingest_csv`      — CSV → `s3a://bronze/crm/`
2. `bronze.ingest_json`     — JSON → `s3a://bronze/erp/`
3. `silver.transform_customers`  — dedup, validate email
4. `silver.transform_products`
5. `silver.transform_orders`
6. `gold.aggregate_fact_orders`  — star schema
7. `gold.aggregate_dim_customers`
8. `gold.aggregate_dim_products`
9. `gold.aggregate_daily_revenue`

Output cuối:
```
═══════════════════════════════════════════════════════════════
  ✅ Pipeline batch_retail completed successfully
  Verify data:
    docker exec lake-minio mc ls --recursive local/bronze/
    docker exec lake-minio mc ls --recursive local/silver/
    docker exec lake-minio mc ls --recursive local/gold/
  Browse in UI:  http://localhost:9001  (minioadmin/minioadmin)
═══════════════════════════════════════════════════════════════
```

## 5. Verify data

```bash
make pipeline-verify
# hoặc
bash scripts/verify_lake_data.sh
```

Output mẫu:
```
─── Layer: bronze ───
  [2026-10-14 11:20:15]     2.5KiB crm/customers/processing_date=2026-10-14/part-00000-*.parquet
  [2026-10-14 11:20:16]     1.8KiB erp/products/processing_date=2026-10-14/part-00000-*.parquet
  ...

─── Layer: silver ───
  ...

─── Layer: gold ───
  ...

=== BRONZE ===
  Total rows in s3a://bronze/: 11000
=== SILVER ===
  Total rows in s3a://silver/: 11000
=== GOLD ===
  Total rows in s3a://gold/: 60  (4 dims + 1 fact + 1 daily)
```

## 6. Browse data trong UI

| Xem gì | URL | Credentials |
|---|---|---|
| MinIO (S3 objects) | http://localhost:9001 | minioadmin/minioadmin |
| Spark (job history) | http://localhost:8080 | - |
| Metabase (BI) | http://localhost:3000 | (first-run setup) |
| Airflow (DAGs) | http://localhost:8088 | admin/admin |
| Kafka (topics) | http://localhost:8081 | - |

### Query trực tiếp từ MinIO (qua Metabase)

1. Mở http://localhost:3000 → tạo admin account
2. **Add database** → chọn **PostgreSQL** (không có S3 driver trong Metabase Community)
3. **Hoặc**: dùng **CSV/JSON upload** từ `mc cat` qua local file
4. **Hoặc**: cài [DuckDB CLI](https://duckdb.org/docs/installation/) rồi:
   ```bash
   duckdb -c "INSTALL delta; LOAD delta; \
     SELECT * FROM delta_scan('s3://bronze/crm/customers/') LIMIT 10"
   ```

## 7. Streaming demo (optional)

### Produce events vào Kafka

```bash
# 100 clickstream events, rate 10/s
make produce-clickstream

# Hoặc custom
bash scripts/produce_kafka.sh clickstream-events 500 50
bash scripts/produce_kafka.sh ecommerce-products-stream 200 20
```

Verify messages đã vào topic:
```bash
docker exec lake-kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list kafka:29092 --topic clickstream-events
# → clickstream-events:0:100  (100 messages)
```

Xem trên UI: http://localhost:8081 → Topics → clickstream-events → Messages

### Run streaming pipeline

```bash
# Read từ Kafka → Bronze Delta (streaming)
bash scripts/run_batch_pipeline.sh --pipeline stream_clickstream

# Hoặc thủ công
docker exec lake-spark-master bash -c '
export HOME=/tmp
export PYTHONPATH=/app-src/src:/opt/spark/python:/opt/spark/python/lib/py4j-0.10.9.7-src.zip
export PYSPARK_PYTHON=python3
/opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0,org.apache.hadoop:hadoop-aws:3.3.4,org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,com.amazonaws:aws-java-sdk-bundle:1.12.262 \
  --conf spark.jars.ivy=/tmp/.ivy2 \
  /app-src/src/lakehouse/pipelines/stream_clickstream.py
'
```

## 8. Troubleshooting

### ❌ `No module named 'dotenv'`
→ Re-build custom Spark image:
```bash
docker build -f Dockerfile.spark -t lake-spark:3.5.0 . --no-cache
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.spark.yml up -d spark-master spark-worker
```

### ❌ `Class org.apache.hadoop.fs.s3a.S3AFileSystem not found`
→ Đảm bảo `hadoop-aws` package được include. Luôn dùng `make pipeline-batch` thay vì gọi `spark-submit` trực tiếp.

### ❌ `Connection refused: minio:9000` từ Spark container
→ `minio` container chưa healthy. Đợi thêm hoặc check `docker logs lake-minio`.

### ❌ `KeeperException$NodeExistsException` (Kafka restart fail)
→ ZK state bị stale. Reset:
```bash
docker compose down -v   # Xoá volumes
docker compose ... up -d
```
**⚠️ Cảnh báo: Sẽ xoá toàn bộ data trong MinIO!**

### ❌ Pipeline chạy nhưng MinIO empty
→ Check Spark logs:
```bash
docker logs lake-spark-master 2>&1 | grep -iE "error|fail" | tail -20
```
→ Có thể do S3A auth sai. Verify credentials:
```bash
docker exec lake-spark-master bash -c '
  export HADOOP_CONF_DIR=/tmp
  hadoop fs -ls s3a://bronze/
' 2>&1 | tail -5
```

## 9. Performance tips

- **Cluster size**: `docker-compose.spark.yml` set worker memory 2g, 2 cores. Cho dataset lớn (>10M rows), bump lên 4-8g.
- **Partitioning**: Bronze/Silver partition theo `processing_date`. Queries nên include filter để prune.
- **Delta optimize**: Sau batch run, compact small files:
  ```sql
  OPTIMIZE delta.`s3a://silver/erp/orders/`
  ```
- **VACUUM**: Xoá Delta history cũ (>7 ngày):
  ```sql
  VACUUM delta.`s3a://bronze/crm/customers/` RETAIN 168 HOURS
  ```
