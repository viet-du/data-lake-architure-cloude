# Data Lakehouse — Dev Environment Links

> **Mục đích:** Tra cứu nhanh tất cả URL cần thiết khi dev trên local (Mac ARM64 / Docker Desktop).
> Core stack (PHASE 2): `docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d`
> Opt-in Control Plane: thêm `-f docker-compose.dev-api.yml` hoặc dùng `make up-api`.

---

## Quick start (1 lệnh)

```bash
# Core stack (storage, spark, airflow, kafka, mongo, redis, metabase)
make up

# Đợi 60s cho healthcheck, sau đó mở các link dưới
sleep 60 && open http://localhost:9001    # MinIO Console
```

Để có thêm API + Web UI:

```bash
# Cách A — Makefile
make up-api

# Cách B — Docker Compose trực tiếp
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml up -d
```

`make down` dừng core stack nhưng **giữ nguyên volumes**. Muốn xóa hết dữ liệu, dùng `make reset` (cần gõ `yes` rồi `RESET`).

## Storage backend — MinIO (default) hoặc Cloudflare R2 (cloud)

| Backend | URL truy cập | Khi nào dùng | Setup |
|---|---|---|---|
| **MinIO** (local Docker) | http://localhost:9001 | Dev offline, demo nội bộ | Default (chạy được ngay) |
| **Cloudflare R2** (cloud) | https://dash.cloudflare.com → R2 | Portfolio, share link, persistent data | [`R2_SETUP.md`](./R2_SETUP.md) |
| **Databricks CE** (lakehouse) | https://community.cloud.databricks.com/ | Demo ấn tượng, native Delta, notebook UI | [`DATABRICKS_SETUP.md`](./DATABRICKS_SETUP.md) |

**Switch backend**: chỉ cần sửa `.env` (set/unset `S3_ENDPOINT`), không cần đổi code.
Local Gold-to-Metabase reporting uses a PostgreSQL mirror; see the runbook below.

---

## 1. Storage & Query

| Service          | URL                            | Port  | Credentials         | Mục đích                            |
| ---------------- | ------------------------------ | ----- | ------------------- | ----------------------------------- |
| **MinIO API**    | http://localhost:9000          | 9000  | minioadmin/minioadmin | S3-compatible data lake backend    |
| **MinIO Console**| http://localhost:9001          | 9001  | minioadmin/minioadmin | GUI browse buckets/objects          |
| **Gold PostgreSQL** | `localhost:5433`             | 5433  | `GOLD_POSTGRES_USER` / `GOLD_POSTGRES_PASSWORD` | Read-optimized mirror for Metabase |
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

Buckets được tạo tự động bởi `lake-minio-init` (service `minio-init` trong
`docker-compose.yml`). Nếu muốn tạo tay: `docker exec lake-minio mc mb local/<bucket>`.

### Hiển thị Gold trên Metabase

Metabase không đọc trực tiếp Delta Lake trên MinIO. Dùng PostgreSQL làm lớp
truy vấn báo cáo: MinIO vẫn là nguồn Gold chuẩn, còn `gold-postgres` là bản
mirror có thể tạo lại bất kỳ lúc nào.

```bash
# Chạy sau khi Gold Delta đã có trên MinIO
bash scripts/sync_gold_to_metabase.sh
```

Thêm database trong Metabase bằng loại **PostgreSQL**:

| Field | Value |
|---|---|
| Display name | `Lakehouse Gold (MinIO)` |
| Host | `gold-postgres` |
| Port | `5432` |
| Database name | `gold_analytics` |
| Username / Password | `GOLD_POSTGRES_USER` / `GOLD_POSTGRES_PASSWORD` trong `.env` (nếu chưa đặt, local mặc định là `metabase` / `lakehouse-local`) |

Sau khi kết nối, sync schema và tạo câu hỏi từ các bảng `fact_orders`,
`daily_revenue`, `dim_customers`, `dim_products` trong schema `public`.
Chạy lại script sau mỗi lần pipeline cập nhật Gold để làm mới bản mirror.

Danh sách route frontend gọi và trạng thái kết nối local được ghi riêng tại
[`../UI_API_CONNECTIONS.md`](../UI_API_CONNECTIONS.md). Swagger/OpenAPI là
nguồn chuẩn cho HTTP method, request schema và response contract.

---

## 2. Streaming (Kafka — Confluent, single broker)

Stack chỉ chạy **một** broker Kafka (Confluent CP-Kafka 7.5.0, single-node).
Mọi code path trong `src/lakehouse/` dùng `KAFKA_BOOTSTRAP=localhost:9092`
(xem `src/lakehouse/core/constants.py`).
Trước PHASE 2 repo có thêm Redpanda + Redpanda Console; cả hai đã được loại
bỏ vì không có code path nào tham chiếu `redpanda:9192`.

| Service            | URL                        | Port  | Credentials             | Mục đích                       |
| ------------------ | -------------------------- | ----- | ----------------------- | ------------------------------ |
| **Kafka Broker** (internal) | `kafka:29092`       | 29092 | (no auth)               | Producer/Consumer trong Docker |
| **Kafka Broker** (external) | `localhost:9092`   | 9092  | (no auth)               | Apps chạy ngoài Docker         |
| **Kafka UI** (Confluent) | http://localhost:8081 | 8081  | -                       | Topics, consumers, messages    |
| **Zookeeper**      | `zookeeper:2181`           | 2181  | -                       | Kafka coordination             |

### Topics đã được tạo sẵn (bởi `kafka-init`)

| Topic                          | Partitions | Source                          | Sink       |
| ------------------------------ | ---------- | ------------------------------- | ---------- |
| `clickstream-events`           | 3          | `clickstream_producer.py`       | silver/clickstream |
| `ecommerce-products-stream`    | 3          | `tiki_crawler.py`               | silver/ecommerce |
| `ecommerce-reviews-stream`     | 3          | (mock)                          | silver/ecommerce |
| `ecommerce-price-stream`       | 3          | (mock)                          | silver/ecommerce |
| `crypto-prices-stream`         | 3          | `crypto_crawler.py`             | silver/    |
| `github-trending-stream`       | 3          | `github_crawler.py`             | silver/    |
| `hackernews-stream`            | 3          | `hackernews_crawler.py`         | silver/    |

> Topic `weather-stream` đã từng được liệt kê trong tài liệu này, nhưng
> `kafka-init` không tạo. Crawler `weather_crawler.py` (nếu chạy) sẽ tự tạo
> topic khi ghi, hoặc bạn có thể tạo tay: `docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --create --if-not-exists --topic weather-stream --partitions 3 --replication-factor 1`.

---

## 3. Workflow Orchestration

| Service                | URL                        | Port  | Credentials     | Mục đích                  |
| ---------------------- | -------------------------- | ----- | --------------- | ------------------------- |
| **Airflow Webserver**  | http://localhost:8088      | 8088  | admin/admin     | DAGs, runs, logs          |

Webserver sử dụng custom image `lake-airflow:2.7.0` (build từ
`Dockerfile.airflow`). Cả `airflow-webserver` và `airflow-scheduler` đều đợi
`airflow-db` ở trạng thái `service_healthy` trước khi start. Scheduler đợi
thêm `airflow-webserver` healthy trước khi chạy task.

### DAGs có sẵn

| DAG ID                       | Schedule    | Mục đích                                         |
| ---------------------------- | ----------- | ------------------------------------------------ |
| `retail_elt_dag`             | Daily       | Mock data → Bronze → Silver → Gold               |
| `clickstream_streaming_dag`  | Hourly      | clickstream-events Kafka → Bronze → Silver → Gold |
| `ecommerce_streaming_dag`    | Hourly      | 3 ecommerce topics → Bronze → Silver → Gold      |

---

## 4. Application Layer (cần `docker-compose.dev-api.yml`)

| Service    | URL                     | Port  | Mục đích                              |
| ---------- | ----------------------- | ----- | ------------------------------------- |
| **Web UI** (Vite + React) | http://localhost:5173 | 5173  | Frontend dashboard cho data lake    |
| **API** (Next.js)        | http://localhost:3001 | 3001  | REST API: query data, trigger jobs   |

`api` depends_on `mongo`, `redis`, `minio` (healthy) và `airflow-webserver`
(healthy). `web` chỉ depends_on `api: service_started`.

### Endpoints chính (API)

Các route hiện tại được mô tả trong Swagger/OpenAPI. Những nhóm route Web UI
dùng nhiều gồm `/api/catalog/*`, `/api/bronze/*`, `/api/silver/*`,
`/api/gold/*`, `/api/crawler/*`, `/api/kafka/*`, `/api/airflow/*`,
`/api/dq/*` và `/api/health/*`. Xem trạng thái kiểm tra kết nối tại
[`../UI_API_CONNECTIONS.md`](../UI_API_CONNECTIONS.md), và tham khảo Swagger
tại <http://localhost:3001/api/docs>.
| `POST` | `/api/pipeline/run/{name}`  | Trigger pipeline (e.g. `retail_elt`)    |
| `GET`  | `/api/jobs?limit=20`        | List BullMQ job history                 |

---

## 5. Auxiliary

| Service          | URL                            | Port  | Credentials              | Mục đích                       |
| ---------------- | ------------------------------ | ----- | ------------------------ | ------------------------------ |
| **Metabase**     | http://localhost:3000          | 3000  | (first-run setup)        | BI dashboard, query Gold PostgreSQL mirror |
| **MongoDB**      | `localhost:27017`             | 27017 | mongoadmin/mongoadmin    | App metadata (api db)          |
| **Redis**        | `localhost:6379`              | 6379  | (no auth)                | BullMQ queue cache, sessions  |

---

## 6. Health & Status

```bash
# Container status
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "lake-"

# MinIO buckets
docker exec lake-minio mc ls local/

# Kafka topics
docker exec lake-kafka kafka-topics --bootstrap-server kafka:29092 --list

# Spark workers
curl -s http://localhost:8080 | grep -i "alive workers" | head -1

# Airflow health
curl -fsS -u admin:admin http://localhost:8088/api/v1/health

# Quick health check for all dev endpoints
bash scripts/check_dev_links.sh
```

---

## 7. Local Docker runtime

Local Docker Compose is the runtime for all tools. Cloudflare R2 is optional storage only; Spark, Airflow, Kafka, API and Web run on this Mac.

| Service | Cloud URL | Where it runs |
| --- | --- | --- |
| **Web UI** | `https://<your-web>.pages.dev` | Cloudflare Pages |
| **API** | `http://localhost:3001` | Docker Compose (`lake-api`) |
| **Airflow** | `http://localhost:8088` | Docker Compose (`lake-airflow-webserver`) |
| **R2 bucket: bronze** | `s3a://bronze` (via `<account-id>.r2.cloudflarestorage.com`) | Cloudflare R2 |
| **R2 bucket: silver** | `s3a://silver` | Cloudflare R2 |
| **R2 bucket: gold** | `s3a://gold` | Cloudflare R2 |
| **R2 bucket: scripts** | `s3a://scripts` | Cloudflare R2 |
| **Spark (batch)** | `http://localhost:8080` | Docker Compose (`lake-spark-master`) |
| **MinIO console** | (local dev only — `http://localhost:9001`) | Docker Compose |
| **Kafka broker** | (local dev only — `localhost:9092`) | Docker Compose (only if streaming needed) |

**Setup guides (chọn 1 tùy nhu cầu):**

- **Local tools + R2 cloud storage** (khuyến nghị cho portfolio): [`R2_SETUP.md`](./R2_SETUP.md) — tools chạy trên Mac, data trên R2
- Local tools + optional R2 storage: [`R2_SETUP.md`](./R2_SETUP.md)
- R2 buckets + tokens: `docs/cloud/r2/SETUP.md`
- Local service mapping: `docs/cloud/SERVICE_MAPPING.md`
- Spark + Delta on R2: `docs/cloud/r2/SPARK_CONFIG.md`

**Quick switch MinIO ↔ R2:**

```bash
# Switch sang R2 (đã có S3_ENDPOINT trong .env)
sed -i '' 's/^#S3_ENDPOINT=/S3_ENDPOINT=/' .env
sed -i '' 's/^MINIO_ENDPOINT=/#MINIO_ENDPOINT=/' .env
make down && make up

# Switch về MinIO
sed -i '' 's/^S3_ENDPOINT=/#S3_ENDPOINT=/' .env
sed -i '' 's/^#MINIO_ENDPOINT=/MINIO_ENDPOINT=/' .env
make down && make up

# Test kết nối R2
./scripts/test_r2_connection.sh
```

---

## 8. Lỗi thường gặp

### ❌ `Connection refused: localhost:8080` (Spark)
→ Spark chưa start xong. `make up` đợi 60s, nếu vẫn fail: `docker logs lake-spark-master`.

### ❌ `404 on MinIO bucket`
→ Bucket chưa tồn tại. Tạo: `docker exec lake-minio mc mb local/<bucket>`.

### ❌ Kafka producer không connect được từ Mac host
→ Dùng `localhost:9092` (external), KHÔNG dùng `kafka:29092` (internal-only).

### ❌ Airflow không thấy DAGs
→ DAG folder được mount read-only vào container. Trigger reload: `docker exec lake-airflow-webserver airflow dags reserialize`.

### ❌ Spark image build chậm trên Apple Silicon
→ Nếu trước đây bạn dùng `docker-compose.spark.yml` (override với
`apache/spark:3.5.0`), bỏ file đó đi. Default `Dockerfile.spark-runtime`
(Bitnami `spark:3.5.6-debian-12-r1`) đã có manifest `linux/arm64` nên chạy
native trên M-series mà không cần QEMU.

### ❌ `airflow-webserver-api` lỗi "address already in use" trên 8088
→ Chỉ dùng `docker-compose.dev-api.yml` làm overlay API/Web. Các file compose
core và Kafka vẫn được truyền rõ ràng theo ví dụ `make up-api`.
