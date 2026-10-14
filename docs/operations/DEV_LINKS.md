# Data Lakehouse — Dev Environment Links

> **Mục đích:** Tra cứu nhanh tất cả URL cần thiết khi dev trên local (Mac ARM64 / Docker Desktop).
> Stack chạy qua `docker compose -f docker-compose.yml -f docker-compose-kafka.yml [-f docker-compose.api.yml] up -d`

---

## Quick start (1 lệnh)

```bash
# Start toàn bộ stack
make up

# Đợi 60s cho healthcheck, sau đó mở các link dưới
sleep 60 && open http://localhost:9001    # MinIO Console
```

Để có thêm API + Web UI:
```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.api.yml up -d
```

---

## 1. Storage & Query

| Service          | URL                            | Port  | Credentials         | Mục đích                            |
| ---------------- | ------------------------------ | ----- | ------------------- | ----------------------------------- |
| **MinIO API**    | http://localhost:9000          | 9000  | minioadmin/minioadmin | S3-compatible data lake backend    |
| **MinIO Console**| http://localhost:9001          | 9001  | minioadmin/minioadmin | GUI browse buckets/objects          |
| **Hive Metastore**| http://localhost:9083          | 9083  | (Thrift)            | Delta table catalog (Metastore URI) |
| **PostgreSQL** (Metastore) | `postgres:5432`    | 5432  | hive/hive           | Hive Metastore DB                   |
| **Spark Master** | http://localhost:8080          | 8080  | -                   | Cluster status, running apps        |
| **Spark App UI** | http://localhost:4040          | 4040  | -                   | Active job logs (mở khi job chạy)   |

### Buckets layout

```
s3a://bronze/       ← raw ingested (CSV, JSON, Kafka events)
  ├─ crm/           ← customers.csv (CSV ingestor)
  ├─ erp/           ← products.csv, orders.json (CSV+JSON ingestor)
  ├─ clickstream/   ← clickstream Kafka events
  └─ ecommerce/     ← ecommerce Kafka events (products, reviews, prices)

s3a://silver/       ← cleaned, typed, deduped
  ├─ crm/customers/
  ├─ erp/products/, erp/orders/
  └─ clickstream/, ecommerce/

s3a://gold/         ← business-level, aggregated
  ├─ dim_customers/
  ├─ dim_products/
  ├─ fact_orders/
  └─ daily_revenue/  (rolling aggregation)
```

---

## 2. Streaming (Kafka)

| Service            | URL                        | Port  | Credentials             | Mục đích                       |
| ------------------ | -------------------------- | ----- | ----------------------- | ------------------------------ |
| **Kafka Broker** (internal) | `kafka:29092`       | 29092 | (no auth)               | Producer/Consumer trong Docker |
| **Kafka Broker** (external) | `localhost:9092`   | 9092  | (no auth)               | Apps chạy ngoài Docker         |
| **Kafka UI** (Confluent) | http://localhost:8081 | 8081  | -                       | Topics, consumers, messages    |
| **Redpanda**       | `redpanda:9192`            | 9192  | (no auth)               | Kafka-compatible, lighter      |
| **Redpanda Console** | http://localhost:8091    | 8091  | -                       | Topics, schemas, throughput    |
| **Zookeeper**      | `zookeeper:2181`           | 2181  | -                       | Kafka coordination             |

### Topics đã được tạo sẵn

| Topic                          | Partitions | Source                          | Sink       |
| ------------------------------ | ---------- | ------------------------------- | ---------- |
| `clickstream-events`           | 3          | `clickstream_producer.py`       | silver/clickstream |
| `ecommerce-products-stream`    | 3          | `tiki_crawler.py`               | silver/ecommerce |
| `ecommerce-reviews-stream`     | 3          | (mock)                          | silver/ecommerce |
| `ecommerce-price-stream`       | 3          | (mock)                          | silver/ecommerce |
| `crypto-prices-stream`         | 3          | `crypto_crawler.py`             | silver/    |
| `github-trending-stream`       | 3          | `github_crawler.py`             | silver/    |
| `weather-stream`               | 3          | `weather_crawler.py`            | silver/    |
| `hackernews-stream`            | 3          | `hackernews_crawler.py`         | silver/    |

---

## 3. Workflow Orchestration

| Service                | URL                        | Port  | Credentials     | Mục đích                  |
| ---------------------- | -------------------------- | ----- | --------------- | ------------------------- |
| **Airflow Webserver**  | http://localhost:8088      | 8088  | admin/admin     | DAGs, runs, logs          |

### DAGs có sẵn

| DAG ID                       | Schedule    | Mục đích                                         |
| ---------------------------- | ----------- | ------------------------------------------------ |
| `retail_elt_dag`             | Daily       | Mock data → Bronze → Silver → Gold               |
| `clickstream_streaming_dag`  | Hourly      | clickstream-events Kafka → Bronze → Silver → Gold |
| `ecommerce_streaming_dag`    | Hourly      | 3 ecommerce topics → Bronze → Silver → Gold      |

---

## 4. Application Layer (cần `docker-compose.api.yml`)

| Service    | URL                     | Port  | Mục đích                              |
| ---------- | ----------------------- | ----- | ------------------------------------- |
| **Web UI** (Vite + React) | http://localhost:5173 | 5173  | Frontend dashboard cho data lake    |
| **API** (Next.js)        | http://localhost:3001 | 3001  | REST API: query data, trigger jobs   |

### Endpoints chính (API)

| Method | Path                        | Mục đích                                |
| ------ | --------------------------- | --------------------------------------- |
| `GET`  | `/api/health`               | Health check                            |
| `GET`  | `/api/buckets`              | Liệt kê MinIO buckets                   |
| `GET`  | `/api/datasets?layer=gold`  | List datasets ở 1 layer (bronze/silver/gold) |
| `GET`  | `/api/query/sql?q=...`      | DuckDB SQL query on top of MinIO/Delta  |
| `POST` | `/api/pipeline/run/{name}`  | Trigger pipeline (e.g. `retail_elt`)    |
| `GET`  | `/api/jobs?limit=20`        | List BullMQ job history                 |

---

## 5. Auxiliary

| Service          | URL                            | Port  | Credentials              | Mục đích                       |
| ---------------- | ------------------------------ | ----- | ------------------------ | ------------------------------ |
| **Metabase**     | http://localhost:3000          | 3000  | (first-run setup)        | BI dashboard, query MinIO/Delta|
| **MongoDB**      | `localhost:27017`             | 27017 | mongoadmin/mongoadmin    | App metadata (api db)          |
| **Redis**        | `localhost:6379`              | 6379  | (no auth)                | BullMQ queue cache, sessions  |

---

## 6. Health & Status

```bash
# Container status
docker ps --format "table {{.Names}}\t{{.Status}}"

# MinIO buckets
docker exec lake-minio mc ls local/

# Kafka topics
docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list

# Spark workers
curl -s http://localhost:8080 | grep -i "alive workers" | head -1

# Airflow health
curl -fsS -u admin:admin http://localhost:8088/api/v1/health
```

---

## Lỗi thường gặp

### ❌ `Connection refused: localhost:8080` (Spark)
→ Spark chưa start xong. `make up` đợi 60s, nếu vẫn fail: `docker logs lake-spark-master`.

### ❌ `404 on MinIO bucket`
→ Bucket chưa tồn tại. Tạo: `docker exec lake-minio mc mb local/<bucket>`.

### ❌ Kafka producer không connect được từ Mac host
→ Dùng `localhost:9092` (external), KHÔNG dùng `kafka:29092` (internal-only).

### ❌ Airflow không thấy DAGs
→ DAG folder được mount read-only vào container. Trigger reload: `docker exec lake-airflow-webserver airflow dags reserialize`.

### ❌ Bitnami Spark fail Ivy trên Apple Silicon
→ Image là linux/amd64, chạy emulation chậm. Workaround: dùng `apache/spark:3.5.6` thay thế.
