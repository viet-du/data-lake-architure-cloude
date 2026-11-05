# Chạy Local Stack trên R2 (R2-mode)

> Mục tiêu: chạy toàn bộ stack (Spark, Airflow, Kafka, API, Web, MongoDB, Redis, Metabase) với **data nằm trên một S3 endpoint kiểu R2** thay vì MinIO `localhost:9000`.
>
> Runbook này **không** chứa access key, secret key, JWT secret hay mật khẩu. Không dán nội dung `.env` / `apps/api/.env.local` vào chat, tài liệu hay git.

---

## 1. Tại sao có "R2 mode"

Code của lakehouse chỉ có **một** code path lưu trữ: các biến S3-compatible `S3_*`.

| Nơi đọc | Biến |
|---|---|
| `src/lakehouse/core/spark.py` → `_get_s3a_configs()` | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_USE_SSL`, `S3_PATH_STYLE_ACCESS` |
| `apps/api/src/config/env.ts` | `S3_*` (fallback về `MINIO_*` khi không có `S3_ENDPOINT`) |
| `apps/api/src/lib/infra/duckdb/client.ts` | `CREATE SECRET … TYPE s3` |
| `scripts/test_r2_connection.sh` | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |

Khi `S3_ENDPOINT` được đặt, MinIO bị bỏ qua hoàn toàn. `docker-compose.r2.yml` (overlay) cung cấp một endpoint S3-compatible kiểu R2 và trỏ Spark / Airflow / API / worker sang đó.

---

## 2. Bật stack

```bash
cd /Users/mac/Documents/data-lake-architecture
make up-r2
```

Lệnh tương đương:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml \
               -f docker-compose.dev-api.yml -f docker-compose.r2.yml up -d
```

Kiểm tra:

```bash
make ps-r2
bash scripts/check_dev_links.sh
curl -fsS http://127.0.0.1:3001/api/health/deep
```

### Các endpoint nổi bật

| Service | URL |
|---|---|
| R2 (S3 API) | http://localhost:9002 |
| R2 (Web console) | http://localhost:9003 |
| Spark Master UI | http://localhost:8080 |
| Airflow | http://localhost:8088 |
| Kafka UI | http://localhost:8081 |
| API | http://localhost:3001 |
| Web | http://localhost:5173 |
| Metabase | http://localhost:3000 |
| MongoDB (Compass) | `mongodb://localhost:27018` |

---

## 3. Xem dữ liệu trên R2

```bash
make r2-ls                       # liệt kê object
docker run --rm --network container:lake-r2 --entrypoint /bin/sh \
  bitnamilegacy/minio-client:2025.7.21-debian-12-r3 -c \
  "mc alias set r2 http://127.0.0.1:9000 r2admin r2adminsecret >/dev/null && mc du r2/lakehouse"
```

Cấu trúc dữ liệu (1 bucket duy nhất, 3 tầng là **prefix**):

```
s3a://lakehouse/bronze/{crm,erp,ecommerce,clickstream}/<table>
s3a://lakehouse/silver/{...}/<table>
s3a://lakehouse/gold/retail/{fact_orders,dim_customers,dim_products,daily_revenue}
```

> ⚠️ Chỉ tạo **một** bucket tên `lakehouse`. Tạo 3 bucket `bronze`/`silver`/`gold` sẽ khiến mọi lệnh ghi trả `NoSuchBucket`.

---

## 4. Chạy pipeline

```bash
make pipeline-batch          # Bronze → Silver → Gold (spark-submit trong lake-spark-master)
make airflow-trigger        # DAG retail_elt_dag
```

---

## 5. Chuyển sang Cloudflare R2 thật

Tài khoản Cloudflare phải **đã bật R2** (Dashboard → R2 → Get started). Sau đó sửa đúng 3 dòng trong `.env`:

```
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2 access key id>
S3_SECRET_KEY=<r2 secret access key>
S3_REGION=auto
S3_USE_SSL=true
S3_PATH_STYLE_ACCESS=true
```

Rồi:

```bash
make down-r2
make up-r2
```

**Không cần sửa code, không cần rebuild image.** Overlay `docker-compose.r2.yml` chỉ override các biến `S3_*` cho container; nếu bạn muốn dùng R2 thật thì bỏ overlay đó đi và đặt biến trong `.env` — `env_file: .env` đã có sẵn trong `docker-compose.yml` cho Spark / Airflow / API / worker.

Kiểm tra kết nối R2 thật:

```bash
./scripts/test_r2_connection.sh
```

---

## 6. Cache extension DuckDB (bắt buộc ở môi trường này)

DuckDB tải extension qua URL **http** (`http://extensions.duckdb.org/...`), mà URL đó trên mạng này trả `302 -> blocked.cgi` (biến thể `https` cùng file trả `200`). API sẽ abort với:

```
HTTP Error: Failed to download extension "httpfs" at URL "http://extensions.duckdb.org/…" (HTTP 302)
```

Vì vậy `.duckdb-extensions/` (git-ignored) chứa sẵn binary `httpfs` + `delta` và được mount read-only vào API và worker:

```yaml
- ./.duckdb-extensions:/tmp/duckdb-home/.duckdb/extensions:ro
```

Nếu image/container bị đổi nền tảng, tải lại:

```bash
mkdir -p .duckdb-extensions/v1.5.6/linux_arm64
for e in httpfs delta; do
  curl -sL "https://extensions.duckdb.org/v1.5.6/linux_arm64/${e}.duckdb_extension.gz" \
    | gunzip > ".duckdb-extensions/v1.5.6/linux_arm64/${e}.duckdb_extension"
done
```

---

## 7. Dừng dịch vụ

```bash
make down-r2          # dừng stack, giữ volumes
```

Không dùng `down -v` trừ khi chủ ý xóa toàn bộ dữ liệu.
