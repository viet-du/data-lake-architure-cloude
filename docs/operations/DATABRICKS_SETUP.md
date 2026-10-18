# Databricks Community Edition — Setup Guide (Local Tools + Databricks Storage)

> **Mục tiêu:** Tất cả tools (Spark, Airflow, API, UI) chạy trên máy Mac, nhưng **data (Bronze/Silver/Gold) lưu trên Databricks Community Edition** thay vì MinIO/R2.
>
> **Chi phí:** **$0** với Community Edition (giới hạn 15GB, single-node cluster).
>
> **Cập nhật gần nhất (Oct 2026):** Hỗ trợ 2 path mode cho Databricks:
>   - `volume` (mặc định, recommended cho CE) — dùng **Unity Catalog Managed Volumes** (`/Volumes/<catalog>/<layer>/<vol_name>/`). Không cần DBFS root, hoạt động trên CE.
>   - `dbfs` (legacy) — dùng `dbfs:/lakehouse/...` (chỉ dùng được trên full Databricks workspaces cho phép DBFS root).

---

## Tại sao chọn Databricks?

| Tiêu chí | MinIO | R2 | Databricks CE |
|---|---|---|---|
| **Chi phí** | $0 (Docker) | $0 (10GB free) | $0 (15GB free) |
| **Delta native** | ⚠️ Tự quản lý | ⚠️ Tự quản lý | ✅ **Native** (Delta protocol) |
| **Schema enforcement** | Tự code | Tự code | ✅ **Built-in** |
| **Time travel** | Có | Có | ✅ Mạnh hơn (query dễ) |
| **Notebook UI** | ❌ | ❌ | ✅ Có sẵn |
| **Industry standard** | Trung bình | Mới | ✅ **Phổ biến nhất** |
| **Portfolio ấn tượng** | Tốt | Tốt | ✅ **Rất tốt** (thầy biết Databricks) |

> **Khuyến nghị cho đồ án cuối kỳ:** Dùng Databricks CE thay vì R2 vì:
> 1. Native Delta Lake (không phải hack Spark config)
> 2. Có UI đẹp để demo
> 3. Thầy/cô reviewer quen thuộc hơn
> 4. Có thể query trực tiếp từ web UI

---

## Bước 1 — Đăng ký Databricks Community Edition

### 1.1. Tạo account

1. Truy cập: https://community.cloud.databricks.com/
2. Click **"Sign Up"** (góc phải trên)
3. Điền:
   - **Email:** dùng email cá nhân (Gmail, Outlook, v.v.)
   - **Password:** mạnh (≥ 12 ký tự, có số + chữ hoa)
   - **Full name:** tên thật
4. Click **"Sign Up"**
5. Vào email → click link verify
6. Đăng nhập lại

> ⚠️ **KHÔNG CẦN** thẻ tín dụng. Hoàn toàn FREE vĩnh viễn.

### 1.2. Workspace cá nhân

Sau khi login, bạn sẽ thấy workspace URL dạng:

```
https://community.cloud.databricks.com/
```

> **Lưu URL này lại** — bạn sẽ cần cho bước sau.

---

## Bước 2 — Chọn Compute

Personal CE workspace của bạn có **2 lựa chọn** — bạn có thể thấy trong trang **Compute** sidebar:

### 2A. Serverless Compute (Recommended cho CE personal workspace)

Personal CE workspace đã có sẵn **2 default serverless compute** (xem screenshot từ Compute page):
- **Default Interactive Compute** — dùng cho notebook (recommended)
- **Default Automated Compute** — dùng cho job tự động (workflows)

**Cách dùng:**
1. Sidebar → **Compute** → click "Serverless" tab (nếu chưa thấy thì vào Compute page trước)
2. Thấy 2 default serverless compute sẵn có → **không cần tạo mới**
3. Mở notebook mới → tự động attach vào **Default Interactive Compute**
4. Code chạy luôn — không cần chờ cluster start

> ✅ **Lợi ích:** Không cần chờ 5-10 phút start cluster. Tự động scale. Đủ cho demo.
> ⚠️ **Hạn chế:** 1 session tại 1 thời điểm. Không custom Spark config.

### 2B. Classic cluster (Nếu cần config Spark chi tiết)

1. Sidebar → **Compute** → click **"Create Compute"** (nút xanh dương)

**Config cluster:**

| Setting | Giá trị |
|---|---|
| **Cluster name** | `datalake-cluster` |
| **Cluster mode** | **Single Node** (Community bắt buộc) |
| **Access mode** | Single User (your-username) |
| **Databricks runtime** | `14.3 LTS` (hoặc mới nhất có sẵn) |
| **Node type** | Để mặc định (Community dùng shared small node) |
| **Auto-termination** | 120 minutes (tắt sau 2h không dùng để tiết kiệm) |

3. Click **"Create Compute"**
4. Đợi ~5-10 phút để cluster start (status chuyển sang xanh lá "Running")
5. Attach notebook vào cluster vừa tạo (chọn từ dropdown ở đầu notebook)

> ✅ **Lợi ích:** Persistent, custom được Spark config, nhiều notebook attach cùng lúc.
> ⚠️ **Hạn chế:** Phải chờ start. Tốn quota (CE giới hạn 1 cluster/workspace).

### Chọn cái nào?

| Use case | Chọn |
|---|---|
| Demo nhanh, 1-2 notebook | **Serverless** (2A) |
| Chạy job dài, cần nhiều notebook | **Classic** (2B) |
| Cần tune Spark (memory, executor count) | **Classic** (2B) |
| Lần đầu dùng, muốn zero-setup | **Serverless** (2A) |

---

## Bước 3 — Lấy Access Token (để code local kết nối)

### 3.1. Tạo Personal Access Token

1. Click **"User Settings"** (góc phải trên, avatar của bạn)
2. Tab **"Access Tokens"**
3. Click **"Generate New Token"**
4. Điền:
   - **Comment:** `datalake-local-dev`
   - **Lifetime:** `90 days` (hoặc 30 ngày tùy bạn)
5. Click **"Generate"**
6. **COPY NGAY** token (dạng: `dapi...`) — chỉ hiện 1 lần

### 3.2. Lấy thông tin cluster

1. Vào **Compute** → click vào cluster `datalake-cluster`
2. Tab **"Configuration"** → copy **"Cluster ID"** (dạng: `1234-567890-abcdef12`)
3. URL workspace là: `https://community.cloud.databricks.com/`

---

## Bước 4 — Cấu hình `.env` (local)

```bash
# Copy template (chỉ làm 1 lần)
cp .env.databricks.template .env

# Sửa các giá trị:
nano .env
```

Các biến quan trọng (giữ nguyên các giá trị khác):

```bash
# Active env
ENV=databricks

# Workspace URL (Community Edition)
DATABRICKS_HOST=https://community.cloud.databricks.com/

# Personal Access Token (paste vào, KHÔNG commit)
DATABRICKS_TOKEN=dapi...

# Path mode (mặc định 'volume' — dùng cho CE)
DATABRICKS_PATH_MODE=volume

# UC catalog (CE mặc định là 'workspace')
DATABRICKS_CATALOG=workspace

# Tên volume cho mỗi layer (đã match với bootstrap script)
DATABRICKS_BRONZE_VOLUME=bronze_data
DATABRICKS_SILVER_VOLUME=silver_data
DATABRICKS_GOLD_VOLUME=gold_data
DATABRICKS_CHECKPOINT_VOLUME=checkpoints
```

> ⚠️ **KHÔNG commit `.env` vào git.** File đã có trong `.gitignore`.

---

## Bước 5 — Verify kết nối + Bootstrap UC

### 5.1. Quick auth diagnostic (kiểm tra token)

```bash
make databricks-diag
```

Output mẫu (khi OK):

```
DATABRICKS_HOST : https://community.cloud.databricks.com/
[1. HOST in .env] HTTP 200
{...user info...}
```

> **Nếu HTTP 401:** Token sai hoặc đã expired. Tạo token mới ở Bước 3.1.
> **Nếu HTTP 403:** Workspace URL không đúng. Sửa `DATABRICKS_HOST`.

### 5.2. Bootstrap catalog/schemas/volumes (idempotent)

Script tự tạo (nếu chưa có):
- 1 catalog (skip nếu tên là `workspace` — CE không cho tạo)
- 3 schemas: `bronze`, `silver`, `gold`
- 4 managed volumes: `bronze_data`, `silver_data`, `gold_data`, `checkpoints`
- 1 smoke write/read inside `bronze.bronze_data` để verify

```bash
make databricks-bootstrap
```

Output mẫu:

```
[0/5] Auth check (GET /api/2.0/preview/scim/v2/Me)
  ✅ Auth OK — user=you@example.com
[1/5] Catalog check
  ✓ Using default catalog 'workspace' (Community Edition default)
[2/5] Ensure schemas exist
  ✅ Created workspace.bronze
  ✓  workspace.silver already exists
  ✓  workspace.gold already exists
[3/5] Ensure volumes exist
  ✅ Created volume workspace.bronze.bronze_data
  ✅ Created volume workspace.bronze.checkpoints
  ...
[5/5] Smoke write/read
  ✅ Wrote: /Volumes/workspace/bronze/bronze_data/smoke_<ts>.txt
  ✅ Read content matches
🎉 Bootstrap complete.
```

### 5.3. Verify paths resolve đúng

```bash
ENV=databricks make databricks-dryrun
```

Output mẫu:

```
============================================================
  ENV      : databricks
  Catalog  : workspace
  Protocol : volume
  Bronze   : /Volumes/workspace/bronze/bronze_data/
  Silver   : /Volumes/workspace/silver/silver_data/
  Gold     : /Volumes/workspace/gold/gold_data/
  Ckpt(B)  : /Volumes/workspace/bronze/bronze_data/_checkpoints/demo/
  Tbl      : workspace.bronze.customers
============================================================
```

---

## Bước 6 — Chạy pipeline trên cluster Databricks

### 6.1. Cách A: Chạy từ Databricks notebook (recommended)

Upload source code lên workspace (chỉ làm 1 lần):

```bash
# Trong terminal local — đẩy src/ lên Databricks Workspace
databricks workspace import_dir src /Workspace/Users/<you>/data-lake-architecture/src
# Hoặc nếu dùng git repo, clone trực tiếp lên cluster
```

Mở notebook mới, paste cell Python đầu tiên:

```python
# Cell 1: Setup
%pip install delta-spark==3.0.0

import sys
sys.path.insert(0, "/Workspace/Users/<you>/data-lake-architecture/src")

# Verify paths
from lakehouse.run_on_databricks import show_storage_layout
show_storage_layout()
```

Cell thứ 2 — chạy batch:

```python
from lakehouse.run_on_databricks import run_batch_retail
run_batch_retail(limit=1000)  # smoke test với 1000 rows
```

Cell thứ 3 — chạy streaming (sau khi có Kafka producer):

```python
from lakehouse.run_on_databricks import run_stream_clickstream
run_stream_clickstream(duration_seconds=120)
```

### 6.2. Cách B: Chạy từ local terminal (Databricks Connect)

```bash
pip install databricks-connect==14.3.*  # khớp với runtime version
databricks-connect configure  # nhập HOST + TOKEN + cluster ID
databricks-connect test
```

Sau khi config, chạy pipeline local nhưng thực thi trên cluster:

```bash
ENV=databricks make pipeline-batch
ENV=databricks make stream-clickstream
```

> ⚠️ Cách B cần cluster đang chạy. Cách A linh hoạt hơn cho demo.

---

## Bước 7 — Kiểm tra data trên Databricks UI

1. Click **"Data"** ở sidebar trái
2. Browse: `workspace.bronze.bronze_data` (managed Volume) HOẶC `workspace.bronze.customers` (Delta table)
3. Click vào table → xem:
   - **Schema** (auto-evolved)
   - **Sample Data** (first 1000 rows)
   - **History** (time travel: mỗi version là 1 lần write)

### Time travel demo

```sql
-- Xem version cũ
SELECT * FROM workspace.bronze.customers VERSION AS OF 1;
-- Xem data tại 1 thời điểm
SELECT * FROM workspace.bronze.customers TIMESTAMP AS OF '2026-10-18 10:00:00';
```

---

## Bước 8 — Switch backend trong `.env`

```bash
# Dùng Databricks (CE)
ENV=databricks
DATABRICKS_PATH_MODE=volume  # hoặc "dbfs" nếu bạn ở full workspace

# Dùng MinIO (default local Docker)
ENV=local

# Dùng Cloudflare R2 (persistent, $0 egress)
ENV=local  # R2 vẫn dùng local env vì s3a:// vẫn chạy
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

Không cần đổi code. Cùng một codebase, chỉ khác `.env`.

---

## Bước 9 — Cấu trúc dữ liệu trên Databricks

Sau khi chạy pipeline, bạn sẽ thấy trong **Data → Databases**:

```
workspace (catalog)
├── bronze (schema)
│   ├── bronze_data (managed Volume — dùng cho path mode "volume")
│   ├── checkpoints (managed Volume)
│   ├── customers (Delta table)
│   └── products
├── silver (schema)
│   ├── silver_data (managed Volume)
│   ├── dim_customers (Delta table)
│   └── fact_orders
└── gold (schema)
    ├── gold_data (managed Volume)
    ├── dim_customers_aggregated
    └── fact_orders_aggregated
```

Mỗi Delta table:
- Query SQL trực tiếp
- Xem schema evolution history
- Time travel
- Vacuum old versions

Mỗi Volume:
- Lưu files raw/checkpoint (path mode = volume)
- Browse qua Data → Volumes → bronze_data
- API access: `GET /api/2.0/fs/files/Volumes/workspace/bronze/bronze_data/...`

---

## Bước 10 — Troubleshooting

### ❌ Lỗi: "Cluster is not accessible"

- Cluster chưa start → vào Compute, check status
- Cluster auto-terminated sau 2h → restart

### ❌ Lỗi: 401 Unauthorized khi chạy `make databricks-diag`

- Token hết hạn hoặc sai → tạo token mới ở Bước 3.1
- Token mới tạo có thể cần 5-15 phút để propagate (UI shows "In progress")

### ❌ Lỗi: "Credential was not sent"

- Token bị trim, copy/paste thiếu ký tự. Re-copy từ Databricks UI.

### ❌ Lỗi: 403 Forbidden

- Sai `DATABRICKS_HOST`. Đảm bảo dùng `https://community.cloud.databricks.com/`
- Token không thuộc workspace đó (rất hiếm trên CE)

### ❌ Lỗi: "DBFS root is not accessible"

- Bạn đang dùng `DATABRICKS_PATH_MODE=dbfs` nhưng cluster là Community Edition (CE disable DBFS root).
- **Fix:** Đổi sang `DATABRICKS_PATH_MODE=volume` (mặc định).
- Sau đó chạy `make databricks-bootstrap` để tạo volumes.

### ❌ Lỗi: "Volume not found" khi write

- Chưa chạy `make databricks-bootstrap`. Volumes chưa tồn tại.

### ❌ Lỗi: "delta-spark pip extra not found" trên notebook

- Cell 1 đã có `%pip install delta-spark==3.0.0`. Re-run cell đó.

### ❌ Data không hiện trong UI

- Click refresh trong Databases page
- Check table name đúng (case-sensitive)

### ❌ Cluster chậm

- Community dùng shared resource → giờ cao điểm có thể chậm
- Thử chạy batch nhỏ trước

---

## Bước 11 — Rollback về MinIO (local)

```bash
sed -i '' 's/^ENV=databricks/ENV=local/' .env
sed -i '' 's/^DATABRICKS_TOKEN=/#DATABRICKS_TOKEN=/' .env
make down && make up
```

---

## Tóm tắt

| Bước | Thời gian | Làm gì |
|---|---|---|
| 1 | 3 phút | Đăng ký Community Edition |
| 2 | 8 phút | Tạo cluster (đợi start ~5-10') |
| 3 | 2 phút | Tạo Access Token |
| 4 | 2 phút | Cấu hình `.env` |
| 5 | 3 phút | `make databricks-diag` + `make databricks-bootstrap` |
| 6 | 5 phút | Upload src/ lên workspace + chạy notebook |
| 7 | 2 phút | Verify data trên UI |
| **Tổng** | **~25 phút** | |

---

## So sánh cuối cùng: R2 vs Databricks

| | R2 | Databricks CE |
|---|---|---|
| **Tốt cho portfolio** | ✅ | ✅✅ |
| **Demo UI** | ❌ (chỉ có web console) | ✅ (Notebook + SQL Editor) |
| **Native Delta** | ⚠️ | ✅ |
| **Setup time** | 25 phút | 25 phút (sau khi có script bootstrap) |
| **Industry value** | Storage thôi | ✅ **Skill quan trọng** cho Data Engineer |
| **Thầy review** | "OK, dùng cloud" | ✅ "Wow, dùng Databricks" |

> **Khuyến nghị cuối:** Nếu bạn muốn **ấn tượng** trong báo cáo cuối kỳ → dùng **Databricks**. Nếu chỉ cần **persistent data đơn giản** → dùng **R2**.

---

## Tài liệu liên quan

- **R2 setup** (nếu muốn dùng thay thế): [`R2_SETUP.md`](./R2_SETUP.md)
- **Full cloud deployment**: [`../architecture/CLOUD_R2_RENDER.md`](../architecture/CLOUD_R2_RENDER.md)
- **Data layout**: [`./DATA_LAYOUT.md`](./DATA_LAYOUT.md)
- **Dev URLs**: [`./DEV_LINKS.md`](./DEV_LINKS.md)
- **Streaming semantics**: [`../architecture/STREAMING_SEMANTICS.md`](../architecture/STREAMING_SEMANTICS.md)
- **Databricks docs chính thức**: https://docs.databricks.com/en/getting-started/community-edition.html
- **Script bootstrap**: [`../../scripts/bootstrap_databricks.sh`](../../scripts/bootstrap_databricks.sh)
- **Script diag**: [`../../scripts/diag_databricks.sh`](../../scripts/diag_databricks.sh)
- **Module notebook**: [`../../src/lakehouse/run_on_databricks.py`](../../src/lakehouse/run_on_databricks.py)
