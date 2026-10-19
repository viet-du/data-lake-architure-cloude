# Cloudflare R2 — Setup Guide (Local Tools + Cloud Storage)

> **Mục tiêu:** Tất cả tools (Spark, Airflow, Kafka, API, UI) chạy trên máy Mac, nhưng **data (Bronze/Silver/Gold + checkpoint) lưu trên Cloudflare R2** thay vì MinIO.
>
> **Chi phí:** $0 với free tier (10 GB storage, 10 triệu requests/tháng, **0$ egress** — đây là điểm mạnh nhất của R2 so với S3).

---

## Tại sao chọn R2?

| Tiêu chí | MinIO (local) | Cloudflare R2 |
|---|---|---|
| Storage free | 50 GB (Docker volume) | 10 GB (free vĩnh viễn) |
| Egress | miễn phí (nội bộ) | **$0** (free tier) |
| S3-compatible | ✅ | ✅ (dùng s3a://) |
| Cần tắt máy? | ❌ Có (mất data) | ✅ Không (data ở cloud) |
| Setup complexity | Trung bình | Thấp |
| Dùng cho portfolio | Khó share | ✅ Có link preview |

---

## Bước 1 — Tạo tài khoản Cloudflare + R2

### 1.1. Đăng ký (nếu chưa có)

1. Truy cập https://dash.cloudflare.com/sign-up
2. Đăng ký bằng email, **không cần thẻ tín dụng** cho free tier
3. Sau khi login, vào menu bên trái → **R2** → **Get started**

### 1.2. Chọn payment plan

- Chọn **"Pay as you go"** hoặc **"Free tier"**
- Free tier bao gồm: 10 GB storage + 10 triệu Class A/B operations + **0$ egress**
- Bạn sẽ cần nhập thẻ tín dụng để xác minh (nhưng **sẽ không bị charge** nếu ở dưới free tier)

> ⚠️ **LƯU Ý QUAN TRỌNG:** Set billing alerts!
> - Vào R2 → Plan → Usage limits
> - Set "Storage used" alert tại **8 GB** (80% free tier)
> - Set "Class A operations" alert tại **8 triệu** (80% free tier)
> - Set "Class B operations" alert tại **8 triệu** (80% free tier)
> - Set "Monthly cost" alert tại **$1** (để bảo vệ tuyệt đối)

---

## Bước 2 — Tạo 3 bucket

Trong R2 dashboard, click **Create bucket**, tạo lần lượt 3 bucket:

| Tên bucket | Region | Public access | Mục đích |
|---|---|---|---|
| `bronze` | APAC (Tokyo) | ❌ Private | Raw data từ CSV/JSON/streaming |
| `silver` | APAC (Tokyo) | ❌ Private | Cleaned + enriched |
| `gold` | APAC (Tokyo) | ❌ Private | Aggregated metrics |

> **Tên bucket phải đúng:** `bronze`, `silver`, `gold` (lowercase, không ký tự đặc biệt). Code `LakePaths` sẽ tự tạo URL `s3a://bronze/`, `s3a://silver/`, `s3a://gold/` — phải khớp.

> **Region APAC:** Chọn "Asia Pacific (Japan)" hoặc gần nhất. Từ Việt Nam thì APAC cho latency thấp hơn US/EU.

---

## Bước 3 — Tạo Access Key

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Đặt tên: `datalake-local-dev`
3. Permissions: chọn **"Object Read & Write"** (không cần Delete cho dev)
4. TTL: chọn **"Forever"** hoặc **30 ngày** (rotate định kỳ)
5. **Specify bucket(s):** chọn cả 3 bucket `bronze`, `silver`, `gold`
6. Click **Create API Token**
7. **COPY NGAY** 2 giá trị (chỉ hiện 1 lần):
   - **Access Key ID** (dạng: `a1b2c3d4e5f6...`)
   - **Secret Access Key** (dạng: `1a2b3c4d5e6f...`)

> ⚠️ **KHÔNG BAO GIỜ** commit 2 key này vào git. Chỉ paste vào `.env` (file git-ignored).

---

## Bước 4 — Lấy Account ID

1. R2 dashboard → bên phải → **Account ID**
2. Copy giá trị (dạng: `abc123def456...`)

Endpoint R2 của bạn sẽ là:

```
https://<account_id>.r2.cloudflarestorage.com
```

---

## Bước 5 — Cấu hình .env trên máy local

### 5.1. Mở file `.env` (đã có từ setup trước)

```bash
cd /Users/mac/Documents/data-lake-architecture
nano .env   # hoặc code .env
```

### 5.2. Comment lại MinIO + bật R2

```bash
# ═══════════════════════════════════════════════════════════════
# MinIO (S3-compatible storage) — TẮT khi dùng R2
# ═══════════════════════════════════════════════════════════════
# MINIO_ENDPOINT=localhost:9000
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=minioadmin
# MINIO_SECURE=false

# ═══════════════════════════════════════════════════════════════
# Cloudflare R2 — BẬT khi muốn lưu data trên cloud
# ═══════════════════════════════════════════════════════════════
S3_ENDPOINT=https://<paste_account_id_here>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<paste_access_key_here>
S3_SECRET_KEY=<paste_secret_key_here>
S3_REGION=auto
S3_USE_SSL=true
S3_PATH_STYLE_ACCESS=true
```

> **Lưu ý:** Thay `<paste_..._here>` bằng giá trị thật. **Không** commit file `.env` lên git (đã có trong `.gitignore`).

### 5.3. Cách switch nhanh MinIO ↔ R2

```bash
# Dùng MinIO (default local)
sed -i '' 's/^S3_ENDPOINT=/#S3_ENDPOINT=/' .env
sed -i '' 's/^#MINIO_ENDPOINT=/MINIO_ENDPOINT=/' .env

# Dùng R2
sed -i '' 's/^#S3_ENDPOINT=/S3_ENDPOINT=/' .env
sed -i '' 's/^MINIO_ENDPOINT=/#MINIO_ENDPOINT=/' .env
```

---

## Bước 6 — Restart stack

```bash
cd /Users/mac/Documents/data-lake-architecture
make down
make up
```

Spark sẽ tự động đọc `S3_ENDPOINT` từ `.env` → dùng R2 thay vì MinIO. **Không cần sửa code.**

---

## Bước 7 — Test kết nối R2

### 7.1. Chạy script test

```bash
./scripts/test_r2_connection.sh
```

Script sẽ:
1. Đọc `S3_ENDPOINT` từ `.env`
2. Liệt kê 3 bucket `bronze`, `silver`, `gold`
3. Upload 1 file test
4. Download lại và so sánh
5. Nếu OK → in "✅ R2 connection successful"

### 7.2. Test Spark write/read

```bash
make shell
# Trong Spark shell:
spark.range(10).write.format("delta").mode("overwrite").save("s3a://bronze/_smoke_test/")
spark.read.format("delta").load("s3a://bronze/_smoke_test/").show()
```

Sau đó vào R2 dashboard → bucket `bronze` → xem có folder `_smoke_test/`.

### 7.3. Test full batch pipeline

```bash
make batch   # chạy Bronze → Silver → Gold
# Sau khi xong, vào R2 dashboard:
# - bucket bronze/ → có folder crm/, erp/
# - bucket silver/ → có folder crm/, erp/
# - bucket gold/ → có folder crm/, erp/
```

---

## Bước 8 — Quản lý chi phí (BẮT BUỘC)

### 8.1. Set billing alerts (làm NGAY)

Vào Cloudflare Dashboard → R2 → Plan → **Usage limits & alerts**:

| Metric | Alert threshold |
|---|---|
| Storage used | 8 GB (80% free tier) |
| Class A operations (PUT) | 8 triệu/tháng |
| Class B operations (GET) | 8 triệu/tháng |
| Monthly cost | $1 |

### 8.2. Monitor usage

Vào R2 → **Metrics** → xem:
- Storage: hiện tại bao nhiêu GB
- Operations: A vs B count
- Egress: **luôn $0** ✅

### 8.3. Khi nào vượt free tier?

| Tình huống | Storage | Operations | Chi phí dự kiến |
|---|---|---|---|
| Demo dataset (3-5 GB) | 3-5 GB | < 1M | **$0** |
| Test lớn (10 GB) | 10 GB | 2-3M | **$0** (còn free tier) |
| Production workload | 50 GB | 10M+ | ~$0.75/tháng |
| Chia sẻ link preview | +0 GB | +10K-100K/lần | **$0** (egress free) |

---

## Bước 9 — Cấu trúc dữ liệu trên R2

Sau khi chạy pipeline, R2 sẽ có cấu trúc:

```
bronze/                          ← bucket
├── crm/
│   ├── customers/
│   │   ├── _delta_log/
│   │   └── processing_date=2026-10-18/
│   └── orders/
├── erp/
└── _smoke_test/                  ← test thử, có thể xóa
silver/
├── crm/
│   ├── dim_customers/
│   └── fact_orders/
└── erp/
gold/
├── crm/
│   ├── dim_customers_aggregated/
│   ├── dim_products_aggregated/
│   └── fact_orders_aggregated/
└── erp/
```

---

## Bước 10 — Troubleshooting

### ❌ Lỗi: `UnknownHostException: <account_id>.r2.cloudflarestorage.com`

- Check `S3_ENDPOINT` đúng format `https://<account_id>.r2.cloudflarestorage.com`
- Check account ID copy đúng (không có space, dấu `/`)

### ❌ Lỗi: `403 Forbidden`

- Access Key/Secret sai → regenerate token mới
- Token chỉ có quyền đọc → tạo token mới với "Object Read & Write"

### ❌ Lỗi: `400 Bad Request: Path style access is not supported`

- R2 **CHỈ hỗ trợ** path-style access
- Set `S3_PATH_STYLE_ACCESS=true` (đã có trong config)

### ❌ Lỗi: `Connection timeout`

- Check Mac có truy cập được `*.r2.cloudflarestorage.com` không
- Thử `curl -I https://<account_id>.r2.cloudflarestorage.com` để test
- Nếu dùng VPN, thử tắt VPN

### ❌ Lỗi: `NoSuchBucket`

- Bucket chưa được tạo trên R2 dashboard
- Tên phải đúng: `bronze`, `silver`, `gold` (lowercase)

### ❌ Spark chậm khi ghi R2

- R2 latency cao hơn MinIO nội bộ (50-200ms vs 5ms)
- Bình thường, không phải lỗi
- Có thể tăng `spark.hadoop.fs.s3a.connection.timeout` lên 60000

---

## Bước 11 — Rollback về MinIO (khi cần)

Nếu R2 có vấn đề, rollback trong 10 giây:

```bash
# Comment R2, bật MinIO
sed -i '' 's/^S3_ENDPOINT=/#S3_ENDPOINT=/' .env
sed -i '' 's/^#MINIO_ENDPOINT=/MINIO_ENDPOINT=/' .env

# Restart
make down && make up
```

Code sẽ tự fallback về `MINIO_ENDPOINT=localhost:9000`.

---

## Bước 12 — Backup trước khi xóa R2 bucket

Khi cần xóa bucket để test lại từ đầu:

```bash
# Backup toàn bộ data về máy local
aws s3 sync s3a://bronze ./backup/r2/bronze/ --endpoint-url $S3_ENDPOINT
aws s3 sync s3a://silver ./backup/r2/silver/ --endpoint-url $S3_ENDPOINT
aws s3 sync s3a://gold ./backup/r2/gold/ --endpoint-url $S3_ENDPOINT
```

(Cần `aws cli` với R2 endpoint override.)

---

## Tóm tắt

| Bước | Thời gian | Làm gì |
|---|---|---|
| 1 | 5 phút | Đăng ký Cloudflare + enable R2 |
| 2 | 2 phút | Tạo 3 bucket `bronze`, `silver`, `gold` |
| 3 | 1 phút | Tạo API token + copy key |
| 4 | 1 phút | Copy Account ID |
| 5 | 2 phút | Edit `.env` |
| 6 | 3 phút | `make down && make up` |
| 7 | 5 phút | Test kết nối + chạy batch |
| 8 | 5 phút | Set billing alerts |
| **Tổng** | **~25 phút** | |

---

**Bạn đã xong setup R2!** Data giờ sống trên cloud, có thể tắt máy Mac, ngày hôm sau bật lên vẫn thấy data nguyên vẹn.

## Tài liệu liên quan

- **Local Docker runtime:** [`./docker.md`](./docker.md)
- **R2 chi tiết với wrangler CLI**: [`../cloud/r2/SETUP.md`](../cloud/r2/SETUP.md)
- **Spark config trên R2** (Delta + S3A tuning): [`../cloud/r2/SPARK_CONFIG.md`](../cloud/r2/SPARK_CONFIG.md)
- **Service mapping** (service nào chạy ở đâu): [`../cloud/SERVICE_MAPPING.md`](../cloud/SERVICE_MAPPING.md)
- **Data layout** (schema các layer): [`./DATA_LAYOUT.md`](./DATA_LAYOUT.md)
- **Dev URLs**: [`./DEV_LINKS.md`](./DEV_LINKS.md)
- **Streaming semantics**: [`../architecture/STREAMING_SEMANTICS.md`](../architecture/STREAMING_SEMANTICS.md)
