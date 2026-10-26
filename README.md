# Data Lakehouse Control Plane

Nền tảng **Data Lakehouse chạy local-first** cho dữ liệu bán lẻ (retail) và thương mại điện tử.
Dự án gồm hai phần chính:

- **Data plane (Python + Spark):** nạp dữ liệu batch (CSV/JSON), streaming (Kafka) và crawler vào
  các bảng Delta theo kiến trúc Medallion **Bronze → Silver → Gold**, lưu trên MinIO (S3 tương thích).
- **Control plane (Next.js API + React Web UI):** giao diện và REST API để duyệt catalog, chạy job,
  điều khiển crawler, theo dõi Kafka/Airflow, chạy Data Quality và EDA.

Airflow điều phối pipeline, Metabase đọc bản sao PostgreSQL của các bảng Gold để vẽ dashboard.
Databricks là nguồn đọc/truy vấn tùy chọn. Mọi lệnh ghi (ETL/ELT) mặc định chạy trên MinIO.

> Tài liệu này được đối chiếu với `docker-compose*.yml`, `Makefile`, `scripts/` và `.env.example`
> trong repo. Các lệnh macOS (Apple Silicon) đã được chạy thật trên stack đang hoạt động.
> Phần Windows và Linux dựa trên cùng cấu hình Docker nhưng chưa được chạy trực tiếp trên máy đó.

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
4. [Cấu trúc repository](#4-cấu-trúc-repository)
5. [Bảng cổng và tài khoản mặc định](#5-bảng-cổng-và-tài-khoản-mặc-định)
6. [Yêu cầu phần cứng](#6-yêu-cầu-phần-cứng)
7. [Cài công cụ theo hệ điều hành](#7-cài-công-cụ-theo-hệ-điều-hành)
8. [Lấy mã nguồn](#8-lấy-mã-nguồn)
9. [Cấu hình biến môi trường](#9-cấu-hình-biến-môi-trường)
10. [Cài dependency](#10-cài-dependency)
11. [Khởi động hạ tầng Docker](#11-khởi-động-hạ-tầng-docker)
12. [Chạy các pipeline dữ liệu](#12-chạy-các-pipeline-dữ-liệu)
13. [Chạy Control Plane (API và Web)](#13-chạy-control-plane-api-và-web)
14. [Tính năng của Control Plane](#14-tính-năng-của-control-plane)
15. [Metabase và Gold PostgreSQL](#15-metabase-và-gold-postgresql)
16. [Databricks và Cloudflare R2 (tùy chọn)](#16-databricks-và-cloudflare-r2-tùy-chọn)
17. [Kiểm thử và kiểm tra chất lượng](#17-kiểm-thử-và-kiểm-tra-chất-lượng)
18. [Vận hành hằng ngày](#18-vận-hành-hằng-ngày)
19. [Xử lý sự cố](#19-xử-lý-sự-cố)
20. [Các điểm cần biết của repo](#20-các-điểm-cần-biết-của-repo)
21. [Bảo mật](#21-bảo-mật)
22. [Tài liệu tham khảo](#22-tài-liệu-tham-khảo)

Nếu bạn chỉ muốn chạy nhanh nhất có thể, đọc mục 7 (cài công cụ), rồi làm tuần tự các mục 8 đến 13.

---

## 1. Tổng quan dự án

Những gì dự án đã xây dựng:

| Nhóm | Nội dung |
|---|---|
| Lakehouse | Bảng Delta Lake 3.0 trên MinIO, ba tầng Bronze, Silver, Gold trong bucket `lakehouse` |
| Batch | Sinh dữ liệu giả (customers, products, orders), nạp CSV/JSON vào Bronze, làm sạch sang Silver, tổng hợp sang Gold |
| Streaming | Kafka (Confluent 7.5.0) với 7 topic, ingestor Spark Structured Streaming cho `clickstream` và `ecommerce` |
| Crawler | Tiki (5 danh mục), GitHub trending, HackerNews, Crypto; scheduler có 8 job và có DAG Airflow |
| Orchestration | Airflow 2.7.0 với 4 DAG: `retail_elt_dag`, `crawler_dag`, `clickstream_streaming_dag`, `ecommerce_streaming_dag` |
| Query engine | Spark 3.5 cho ghi; DuckDB nhúng (extension `httpfs`, `delta`) cho đọc trong API |
| Metadata | MongoDB lưu catalog, job, rule DQ, hồ sơ EDA, audit; Redis làm cache và hàng đợi BullMQ |
| Control Plane | API Next.js 15 (cổng 3001) và Web UI React + Vite (cổng 5173) |
| BI | Gold Delta được đồng bộ sang PostgreSQL `gold_analytics` cho Metabase |
| Chất lượng | Rule Data Quality (6 loại), suite DQ, EDA profiling, quality gate |
| Cloud tùy chọn | Databricks (đọc, truy vấn), Cloudflare R2 (lưu trữ lạnh, thay thế MinIO) |

Ý nghĩa của ba tầng:

- **Bronze:** dữ liệu thô, giữ nguyên cấu trúc nguồn, thêm metadata nạp.
- **Silver:** dữ liệu đã làm sạch, khử trùng lặp, ép kiểu, làm giàu.
- **Gold:** bảng phục vụ phân tích: `fact_orders`, `dim_customers`, `dim_products`, `daily_revenue`.

## 2. Kiến trúc hệ thống

```text
                      NGUỒN DỮ LIỆU
   CSV/JSON (data-samples)    Kafka topics        Crawlers (Tiki, GitHub, HN, Crypto)
            |                      |                          |
            +----------------------+--------------------------+
                                   |
                         Spark (spark-submit / PySpark)
                                   |
        +--------------------------+--------------------------+
        v                          v                          v
   Bronze (Delta)  ------>   Silver (Delta)  ------>    Gold (Delta)
        \_______________ MinIO: s3a://lakehouse/{layer}/{database}/{table} ______/
                                   |
              +--------------------+---------------------+
              v                                          v
   DuckDB (httpfs + delta)                 sync_gold_to_metabase.sh
   đọc trong API                                         |
              |                                          v
              v                              PostgreSQL gold_analytics (:5433)
   Next.js API :3001  <--- BullMQ (Redis) ---> Worker                |
        |        \--- MongoDB (catalog, DQ, EDA)                     v
        v                                                      Metabase :3000
   React Web UI :5173

   Airflow :8088 điều phối DAG, gọi spark-submit qua Docker socket
```

Quy ước đường dẫn trong MinIO: `s3a://lakehouse/{layer}/{database}/{table}`, ví dụ
`s3a://lakehouse/bronze/crm/customers`. Bucket mặc định là `lakehouse` (biến `LAKEHOUSE_BUCKET`).

Hai biến cấu hình độc lập, dễ nhầm:

- `LAKEHOUSE_DATA_SOURCE` (`local` hoặc `databricks`): nơi API **đọc** mặc định.
- `LAKEHOUSE_EXECUTION_TARGET` (`local_delta_minio` hoặc `databricks_uc`): nơi các job **ghi** chạy.
  Giá trị `databricks_uc` chưa được hiện thực, mọi thao tác ghi tới nó bị từ chối với mã `DATABRICKS_READ_ONLY`.

Vì vậy bạn có thể đọc dữ liệu từ Databricks nhưng vẫn ghi vào MinIO.

## 3. Công nghệ sử dụng

| Lớp | Công nghệ | Phiên bản (theo repo) |
|---|---|---|
| Lưu trữ đối tượng | MinIO (`cgr.dev/chainguard/minio`) | latest |
| Định dạng bảng | Delta Lake | 3.0.0 |
| Xử lý | Apache Spark (image Bitnami legacy) | 3.5.6 (image), PySpark 3.5.9 trong venv của container |
| Truy vấn nhúng | DuckDB (`@duckdb/node-api`) | 1.5.x |
| Streaming | Kafka + ZooKeeper (Confluent) | 7.5.0 |
| Giao diện Kafka | provectuslabs/kafka-ui | latest |
| Điều phối | Apache Airflow (LocalExecutor) | 2.7.0, Python 3.11 |
| Cơ sở dữ liệu metadata | MongoDB | 7 |
| Cache và queue | Redis (`redis:7-alpine`), BullMQ | 7 |
| PostgreSQL | metastore (13), Airflow DB (13), Gold mirror (16-alpine) | 13 / 16 |
| BI | Metabase | latest |
| API | Next.js, TypeScript, Zod, Mongoose, kafkajs, ioredis | Next 15, React 19 |
| Web | React 19, Vite 5, Tailwind 3, TanStack Query, i18next (EN/VI), three.js | |
| Python | `lakehouse` package (pyspark, delta-spark, kafka-python, boto3, minio, pandas, great-expectations) | Python >= 3.10 |
| Java | Temurin JDK 17 (được cài sẵn trong image Airflow) | 17.0.10+7 |
| Hạ tầng | Docker Compose, Makefile, GitHub Actions CI, Terraform (thư mục `terraform/`) | |

## 4. Cấu trúc repository

```text
.
├── apps/
│   ├── api/                  Control Plane API (Next.js 15, TypeScript)
│   │   ├── src/app/api/      Route handlers REST (airflow, bronze, silver, gold, catalog,
│   │   │                     crawler, dq, eda, kafka, health, info, ...)
│   │   ├── src/modules/      Logic theo module: airflow, bronze, catalog, crawler, dashboard,
│   │   │                     datasets, dq, eda, gold, gold-queries, health, kafka, operations,
│   │   │                     security, silver
│   │   ├── src/workers/      Worker BullMQ (tiêu thụ hàng đợi bronze/silver/gold/crawler)
│   │   ├── src/lib/infra/    Client DuckDB, Databricks, Kafka, Spark job-runner
│   │   ├── env-loader.js     Bộ nạp biến môi trường chuẩn (đọc apps/api/.env.local)
│   │   ├── Dockerfile        Image API (node:20-bookworm-slim, glibc)
│   │   └── Dockerfile.worker Image worker (dựa trên lake-airflow:2.7.0, có Python + Spark)
│   └── web/                  Web UI (React 19 + Vite + Tailwind), build ra nginx
├── airflow_dags/             4 DAG: retail_elt, crawler, clickstream_streaming, ecommerce_streaming
├── src/lakehouse/            Gói Python `lakehouse`
│   ├── ingest/               batch (csv_ingestor, json_ingestor) và streaming
│   ├── transform/            Bronze -> Silver
│   ├── aggregate/            Silver -> Gold
│   ├── pipelines/            batch_retail, stream_clickstream, stream_ecommerce
│   ├── sources/              mock generator, crawlers, producers, scheduler
│   ├── quality/              Data Quality (Python)
│   ├── storage/ core/        Spark session, đường dẫn, hằng số, nạp env
│   ├── jobs/                 `python -m lakehouse.jobs.runner` (API gọi job qua đây)
│   └── tools/                sync_gold_to_postgres, verify_minio_delta, crawler_minio_etl
├── scripts/                  Script vận hành (start, stop, reset, verify, pipeline, Databricks)
├── configs/                  Cấu hình Spark (spark-defaults.conf) và các cấu hình khác
├── data-samples/             Dữ liệu đầu vào cục bộ (bị .gitignore, tự sinh ra)
├── sql/ notebooks/ experiments/ terraform/ infra/   Tài nguyên phụ trợ
├── tests/                    Test Python (pytest)
├── docs/                     Tài liệu kiến trúc, vận hành, API
├── docker-compose.yml        Hạ tầng lõi: MinIO, Postgres, Spark, Airflow, Metabase, Mongo, Redis
├── docker-compose-kafka.yml  ZooKeeper, Kafka, Kafka UI, kafka-init (tạo topic)
├── docker-compose.dev-api.yml  Lớp phủ tùy chọn: api, worker, web
├── Dockerfile.airflow        Image Airflow + JDK 17 + JAR Spark/Delta/S3A/Kafka
├── Dockerfile.spark-runtime  Image Spark master/worker + venv Python
├── Makefile                  Lệnh tắt (chạy `make help`)
├── quickstart.sh             Script cài nhanh (xem cảnh báo ở mục 20)
├── pyproject.toml            Khai báo gói Python `lakehouse`
├── package.json, pnpm-workspace.yaml   Workspace pnpm (apps/*)
└── .env.example, .env.databricks.template   Mẫu biến môi trường
```

## 5. Bảng cổng và tài khoản mặc định

Tất cả cổng dưới đây là cổng trên **máy host** sau khi khởi động.

| Dịch vụ | Địa chỉ | Tài khoản mặc định | Compose |
|---|---|---|---|
| Web UI | http://localhost:5173 | không | dev-api |
| API | http://localhost:3001 | không (xác thực tắt mặc định) | dev-api |
| Swagger | http://localhost:3001/api-doc (`/api/docs` tự chuyển hướng tới đây) | không | dev-api |
| MinIO API | localhost:9000 | `minioadmin` / `minioadmin` | core |
| MinIO Console | http://localhost:9001 | `minioadmin` / `minioadmin` | core |
| Spark Master UI | http://localhost:8080 | không | core |
| Spark master (RPC) | spark://localhost:7077 | không | core |
| Spark app UI | http://localhost:4040 | không (chỉ có khi job đang chạy) | core |
| Airflow | http://localhost:8088 | `admin` / `admin` | core |
| Kafka UI | http://localhost:8081 | không | kafka |
| Kafka (từ host) | localhost:9092 | không | kafka |
| Kafka (trong mạng Docker) | kafka:29092 | không | kafka |
| ZooKeeper | localhost:2181 | không | kafka |
| MongoDB | localhost:27017 | `mongoadmin` / `mongoadmin` | core |
| Redis | localhost:6379 | không mật khẩu | core |
| Gold PostgreSQL | localhost:5433 | `metabase` / `lakehouse-local` | core |
| Metabase | http://localhost:3000 | tạo ở lần đầu | core |

PostgreSQL metastore (`lake-postgres`, user `hive`) và Airflow DB (`lake-airflow-db`, user `airflow`)
không mở cổng ra host, chỉ dùng trong mạng Docker.

Vì sao Airflow là 8088 chứ không phải 8080: cổng 8080 đã dành cho Spark UI, nên Airflow được ánh xạ
`8088:8080`. Trong mạng Docker các service gọi Airflow qua `http://airflow-webserver:8080`.

Các mật khẩu trên chỉ dùng cho phát triển local. Đổi chúng trước khi mở dịch vụ ra ngoài máy bạn.

## 6. Yêu cầu phần cứng

| Thành phần | Tối thiểu | Khuyến nghị |
|---|---|---|
| RAM dành cho Docker | 8 GB | 12 GB trở lên |
| CPU dành cho Docker | 4 nhân | 6 nhân trở lên |
| Ổ đĩa trống | 25 GB | 40 GB (image Spark, Airflow, Node, volume dữ liệu) |
| Mạng | Cần Internet ở lần build đầu | Cần tải image, JAR từ Maven Central, JDK từ GitHub |

Con số RAM là khuyến nghị của tôi, rút ra từ cấu hình trong repo và sự cố đã gặp, không phải kết quả đo
cho từng cấu hình máy. Stack chạy đồng thời hơn 15 container (hai JVM Spark, Kafka, ZooKeeper, Airflow,
MongoDB, Metabase...). Khi Docker được cấp dưới 8 GB, build Next.js và job Spark dễ bị kernel kill (mã thoát 137).
Máy tham chiếu dùng để kiểm tra tài liệu này: Docker 8.3 GB RAM, 10 CPU, kiến trúc `aarch64`.

Kiểm tra tài nguyên Docker đang có:

```bash
docker info --format '{{.MemTotal}} bytes, {{.NCPU}} cpus, {{.Architecture}}'
```

## 7. Cài công cụ theo hệ điều hành

### 7.0 Danh sách công cụ cần có

| Công cụ | Phiên bản | Dùng để | Bắt buộc? |
|---|---|---|---|
| Git | bất kỳ bản mới | Lấy mã nguồn | Có |
| Docker + Compose v2 | Docker 24+, lệnh `docker compose` (có dấu cách) | Chạy toàn bộ hạ tầng | Có |
| Node.js | 20 trở lên (CI dùng 20) | Chạy API và Web ở chế độ dev, chạy test | Có nếu chạy dev hoặc test |
| pnpm | 9 trở lên (đã kiểm tra với 9.15.9) | Quản lý workspace `apps/*` | Có nếu dùng Node |
| Python | 3.10 trở lên (CI dùng 3.12) | Sinh dữ liệu mock, crawler scheduler, pytest, lint | Có nếu chạy Python trên host |
| GNU Make | bất kỳ | Lệnh tắt `make up`, `make help`... | Khuyến nghị |
| Bash, curl, openssl | | Script trong `scripts/`, sinh khóa Fernet | Có |
| Java JDK | 17 | Chỉ khi chạy Spark **trên host** (`make demo`, `make spark-shell`, pytest dùng Spark) | Không (Docker đã có sẵn JDK) |

Điểm quan trọng: để chạy stack bằng Docker, host **không cần** Java, Spark hay Python.
Spark, Airflow và worker đều có JDK 17 bên trong image. Máy tham chiếu của tài liệu này không cài Java mà
stack vẫn chạy bình thường.

Script trong repo viết bằng Bash. **Windows phải dùng WSL2**, không chạy script trực tiếp bằng PowerShell hay CMD.

### 7.1 macOS (Apple Silicon M1/M2/M3/M4 và Intel)

**Bước 1. Công cụ dòng lệnh của Xcode** (cho `git` và `make`):

```bash
xcode-select --install
```

**Bước 2. Homebrew** (bỏ qua nếu đã có `brew --version`):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Sau khi cài, làm theo phần "Next steps" mà Homebrew in ra để thêm `brew` vào `PATH`.
Trên Apple Silicon thường là:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Bước 3. Docker Desktop:**

```bash
brew install --cask docker
open -a Docker
```

Chờ biểu tượng cá voi chuyển sang trạng thái chạy. Sau đó vào **Docker Desktop → Settings → Resources**
và đặt:

- Memory: **ít nhất 8 GB**, nên 10 đến 12 GB nếu máy có 16 GB RAM.
- CPUs: 4 đến 6.
- Disk image size: 64 GB trở lên.

Nhấn **Apply & restart**. Đây là bước hay bị bỏ qua nhất và là nguyên nhân chính của lỗi hết bộ nhớ (mục 19).

**Bước 4. Node.js 20 và pnpm 9:**

```bash
brew install node@20
echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc   # Apple Silicon
# Intel Mac dùng đường dẫn: /usr/local/opt/node@20/bin
source ~/.zshrc
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

`node@20` là bản "keg-only" của Homebrew nên bắt buộc phải thêm vào `PATH` như trên.
Nếu bạn đã có Node 20 trở lên từ nơi khác (nvm, fnm), có thể bỏ qua bước này.

**Bước 5. Python 3.12 (khuyến nghị) và Make:**

```bash
brew install python@3.12
python3.12 --version
```

macOS đã có GNU Make 3.81 qua Xcode CLT, đủ dùng cho `Makefile` của repo.

**Bước 6. (Tùy chọn) Java 17**, chỉ khi chạy Spark trên host:

```bash
brew install --cask temurin@17
/usr/libexec/java_home -v 17
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
```

**Lưu ý kiến trúc CPU trên macOS:** `Dockerfile.airflow` đang tải JDK `aarch64`, đúng cho Apple Silicon.
**Nếu bạn dùng Mac Intel (x86_64), phải làm bước "đổi JDK sang x64" ở mục 7.5 trước khi build.**

### 7.2 Linux (Ubuntu 22.04/24.04 và Debian 12)

**Bước 1. Gói cơ bản:**

```bash
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates gnupg openssl build-essential \
  python3 python3-venv python3-pip
```

**Bước 2. Docker Engine và Compose v2** theo kho apt chính thức của Docker.
Với **Ubuntu**:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Với **Debian**, thay hai chỗ `ubuntu` trong URL bằng `debian`.

Cho phép chạy Docker không cần `sudo` và bật dịch vụ:

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker            # hoặc đăng xuất rồi đăng nhập lại
docker run --rm hello-world
docker compose version
```

**Bước 3. Node.js 20 và pnpm 9 qua nvm** (không cần `sudo`, tránh lỗi quyền của `corepack`):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc          # hoặc mở terminal mới
nvm install 20
nvm use 20
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

Lệnh đầu tải script từ GitHub rồi chạy ngay. Nếu bạn muốn kiểm tra trước, tải về và đọc nó trước khi chạy.
Có thể thay `v0.40.1` bằng bản nvm mới hơn trên trang phát hành của dự án.

**Bước 4. (Tùy chọn) Java 17**, chỉ khi chạy Spark trên host:

```bash
sudo apt-get install -y openjdk-17-jre-headless
java -version
```

**Bước 5. Quyền truy cập Docker socket cho Airflow (quan trọng trên Linux):**
Các DAG của Airflow chạy `docker exec lake-spark-master spark-submit ...`, nên container Airflow
mount `/var/run/docker.sock` (xem `docker-compose.yml`). Trên Docker Desktop (macOS, Windows) socket này mở rộng quyền,
nhưng trên **Linux native** socket thuộc `root:docker` với quyền `srw-rw----`, còn user `airflow` (uid 50000, nhóm `root`)
trong container **không có quyền** ghi vào nó. Hậu quả: task nào dùng `docker exec` sẽ lỗi `permission denied`.
Tôi không có máy Linux để chạy thử, nên cách xử lý dưới đây chưa được kiểm chứng trực tiếp.

Cách khuyến nghị: thêm nhóm docker của host vào hai service Airflow bằng file override.
Tạo file `docker-compose.linux.yml` ở thư mục gốc repo:

```yaml
services:
  airflow-webserver:
    group_add:
      - "${DOCKER_GID}"
  airflow-scheduler:
    group_add:
      - "${DOCKER_GID}"
```

Rồi khởi động với file này (không dùng `make up` vì Makefile không biết file override):

```bash
export DOCKER_GID=$(getent group docker | cut -d: -f3)
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.linux.yml up -d
```

Cách nhanh chỉ cho máy cá nhân dùng một lần: `sudo chmod 666 /var/run/docker.sock`.
Cách này cho mọi user trên máy quyền điều khiển Docker (tương đương root), và bị đặt lại khi Docker khởi động lại.

### 7.3 Windows 10/11 (WSL2 + Docker Desktop)

Repo này dùng script Bash, đường dẫn kiểu Unix và bind mount (`./src:/app-src/src`). Cách ổn định nhất trên Windows là
chạy **mọi thứ bên trong WSL2 (Ubuntu)**, kết hợp Docker Desktop dùng backend WSL2. Không clone repo vào `C:\` rồi chạy từ PowerShell.

Yêu cầu: Windows 10 bản 2004 trở lên (build 19041+) hoặc Windows 11, bật ảo hóa (Virtualization) trong BIOS/UEFI.
Kiểm tra trong Task Manager → Performance → CPU → "Virtualization: Enabled".

**Bước 1. Cài WSL2 và Ubuntu.** Mở **PowerShell với quyền Administrator**:

```powershell
wsl --install -d Ubuntu-24.04
```

Khởi động lại máy nếu được yêu cầu, mở "Ubuntu" từ Start Menu và tạo tên người dùng, mật khẩu Linux.
Kiểm tra phiên bản WSL của distro:

```powershell
wsl -l -v
```

Cột `VERSION` phải là `2`. Nếu là `1`, chạy `wsl --set-version Ubuntu-24.04 2`.

**Bước 2. Cài Docker Desktop** từ https://www.docker.com/products/docker-desktop/ (hoặc `winget install -e --id Docker.DockerDesktop`).
Trong **Settings**:

- General: bật **Use the WSL 2 based engine**.
- Resources → WSL Integration: bật **Enable integration with my default WSL distro** và bật công tắc cho `Ubuntu-24.04`.
- Bấm **Apply & restart**.

**Bước 3. Giới hạn tài nguyên của WSL2.** Với backend WSL2, bộ nhớ Docker được quyết định bởi file `%UserProfile%\.wslconfig`
(không phải thanh trượt trong Docker Desktop). Tạo file `C:\Users\<tên bạn>\.wslconfig`:

```ini
[wsl2]
memory=10GB
processors=6
swap=4GB
```

Chọn `memory` bằng khoảng 60 đến 70% RAM máy (máy 16 GB: dùng 10GB). Áp dụng bằng PowerShell:

```powershell
wsl --shutdown
```

Mở lại Docker Desktop và Ubuntu. Kiểm tra trong Ubuntu:

```bash
free -h
docker info --format '{{.MemTotal}} bytes, {{.NCPU}} cpus'
```

**Bước 4. Cài công cụ bên trong Ubuntu (WSL).** Mở terminal Ubuntu và làm đúng như mục 7.2 Linux, nhưng **bỏ qua cài Docker Engine**
(Docker Desktop đã cung cấp lệnh `docker` cho WSL). Chỉ cần:

```bash
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates openssl build-essential python3 python3-venv python3-pip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
corepack enable
corepack prepare pnpm@9.15.9 --activate
docker version
docker compose version
```

Nếu `docker version` báo không tìm thấy lệnh, quay lại bước 2 và kiểm tra WSL Integration.

**Bước 5. Chặn lỗi xuống dòng CRLF.** Repo không có `.gitattributes`. Nếu Git trên Windows chuyển file sang CRLF,
các script `.sh` sẽ lỗi `bad interpreter: /bin/bash^M`. Cấu hình Git **bên trong WSL** trước khi clone:

```bash
git config --global core.autocrlf input
```

**Bước 6. Clone repo vào hệ file của WSL**, ví dụ `~/projects`, **không** clone vào `/mnt/c/...`.
Hệ file Windows qua `/mnt/c` chậm hơn nhiều với `pnpm install` và `next build`, và hay gây lỗi quyền file.

```bash
mkdir -p ~/projects && cd ~/projects
```

Rồi tiếp tục mục 8. Từ Windows có thể mở thư mục này trong VS Code bằng `code .` (cần extension "WSL"),
hoặc duyệt tới `\\wsl$\Ubuntu-24.04\home\<user>\projects`.

**Bước 7. Truy cập từ trình duyệt Windows.** Các cổng (`localhost:5173`, `localhost:3001`, `localhost:8088`...) được
Docker Desktop và WSL2 chuyển tiếp về `localhost` của Windows, nên mở trình duyệt Windows bình thường.

Lưu ý riêng cho Windows:

- Chạy mọi lệnh `make`, `bash scripts/...`, `docker compose`, `pnpm` **trong terminal Ubuntu**, không phải PowerShell.
- Nếu một cổng bị chiếm (ví dụ 3000, 5433, 8080 do phần mềm khác), xem mục 19.
- Nếu Windows dùng ARM (Surface Pro X, Copilot+ PC ARM), làm theo mục 7.5 như Apple Silicon (JDK `aarch64`, mặc định của repo).
  Windows x64 thông thường phải đổi JDK sang `x64`.

### 7.4 Kiểm tra công cụ đã đủ

Chạy khối lệnh sau (macOS, Linux, hoặc terminal Ubuntu trên WSL):

```bash
git --version
docker --version
docker compose version
make --version | head -1
node -v            # phải là v20 trở lên
pnpm -v            # phải là 9 trở lên
python3 --version  # 3.10 trở lên
openssl version
docker run --rm hello-world
```

Mỗi lệnh phải in ra phiên bản, không có `command not found`. Nếu `docker run` lỗi quyền, xem mục 19.

### 7.5 Chỉ Mac Intel, Windows x64 và Linux x64/amd64: đổi JDK trong `Dockerfile.airflow`

`Dockerfile.airflow` tải JDK Temurin 17 bản **`aarch64`** (có SHA256 cố định) để phù hợp Apple Silicon và ARM.
Trên máy x86_64, tệp thực thi `java` của bản `aarch64` sẽ không chạy được, nên image Airflow (và cả worker, vì worker dựa trên nó)
hỏng khi chạy Spark. Cách xử lý là đổi sang bản `x64`, đã kiểm tra trên bản sao tạm của file:

Linux và WSL (GNU sed):

```bash
sed -i \
  -e 's/jdk_aarch64_linux_hotspot/jdk_x64_linux_hotspot/' \
  -e 's/6e4201abfb3b020c1fb899b7ac063083c271250bf081f3aa7e63d91291a90b74/a8fd07e1e97352e97e330beb20f1c6b351ba064ca7878e974c7d68b8a5c1b378/' \
  Dockerfile.airflow
```

macOS Intel (BSD sed cần `-i ''`):

```bash
sed -i '' \
  -e 's/jdk_aarch64_linux_hotspot/jdk_x64_linux_hotspot/' \
  -e 's/6e4201abfb3b020c1fb899b7ac063083c271250bf081f3aa7e63d91291a90b74/a8fd07e1e97352e97e330beb20f1c6b351ba064ca7878e974c7d68b8a5c1b378/' \
  Dockerfile.airflow
```

Hai giá trị thay đổi là tên file JDK và mã SHA256 tương ứng. Mã `a8fd07e1...` là checksum chính thức của
`OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz`, lấy từ trang phát hành Adoptium. Kiểm tra lại bằng:

```bash
grep -nE "aarch64|x64_linux|JAVA_SHA256" Dockerfile.airflow
```

Sau lệnh trên, `Dockerfile.airflow` sẽ hiện là file đã sửa trong `git status`. Đây là thay đổi cục bộ, bạn không nên commit nếu cả nhóm dùng ARM.

Tôi chỉ kiểm chứng phần Dockerfile này. Các image khác (`bitnamilegacy/spark`, `confluentinc/*`, `postgres`, `mongo`, `redis`, `metabase`)
là image đa kiến trúc phổ biến, nhưng tôi chưa build chúng trên máy x86_64.

## 8. Lấy mã nguồn

Chạy trong terminal macOS, terminal Linux hoặc terminal Ubuntu của WSL:

```bash
git clone <URL-repository-của-bạn> data-lake-architure-cloude
cd data-lake-architure-cloude
git checkout dev-v3        # nhánh đang phát triển; bỏ qua nếu bạn dùng nhánh mặc định
```

Từ đây trở đi, **mọi lệnh chạy ở thư mục gốc repo** trừ khi có ghi chú khác. Tên thư mục `data-lake-architure-cloude`
(có chữ "architure") đúng như tên repo, không phải lỗi chính tả của tài liệu này.

## 9. Cấu hình biến môi trường

Repo dùng **ba** file môi trường khác nhau. Cả ba đều bị `.gitignore`, không bao giờ commit chúng.

| File | Ai đọc | Bắt buộc? |
|---|---|---|
| `.env` (thư mục gốc) | Docker Compose (`env_file`) cho Spark, Airflow, API, worker; script Python | **Có** |
| `apps/api/.env.local` | API và worker Next.js (chạy trong Docker hoặc chạy trên host) | Có nếu dùng Control Plane |
| `apps/web/.env` | Vite (Web UI) | Không (có giá trị mặc định) |

Quy tắc ưu tiên của API: file `apps/api/.env.local` **thắng** biến đã `export` sẵn trong shell khi chạy trên máy dev
(chế độ `file`). Bên trong container, biến môi trường do Compose đặt thắng file (chế độ `ambient`).
Kiểm tra API đang đọc cấu hình nào:

```bash
cd apps/api && pnpm run env:check
```

Lệnh này in file được dùng, chế độ, và vài giá trị (MinIO, Kafka, Mongo, Redis). Cần chạy `pnpm install` trước (mục 10).

### 9.1 Tạo `.env` ở thư mục gốc

```bash
cp .env.example .env
```

(Hoặc `make env`, chỉ tạo nếu chưa có.) Sau đó **sửa 3 thứ bắt buộc** trong `.env`:

**(a) Khóa Fernet của Airflow.** Compose dùng `${AIRFLOW_FERNET_KEY:?...}` và sẽ dừng ngay nếu biến này trống.
Giá trị mẫu `generate-a-fernet-key` **không phải khóa hợp lệ** (Fernet cần 32 byte base64 url-safe, tức 44 ký tự).
Sinh khóa mới bằng `openssl` (có sẵn trên macOS, Linux, WSL, đã kiểm tra cho ra khóa 44 ký tự được thư viện `cryptography` chấp nhận):

```bash
openssl rand -base64 32 | tr '+/' '-_'
```

Dán kết quả vào dòng `AIRFLOW_FERNET_KEY=` trong `.env`. Trong `.env.example` biến này nằm ở gần cuối file, và nó chỉ xuất hiện một lần.

**(b) Nguồn dữ liệu đọc mặc định.** `.env.example` đặt `LAKEHOUSE_DATA_SOURCE=databricks`.
Nếu bạn **không có** tài khoản Databricks, đổi thành:

```dotenv
LAKEHOUSE_DATA_SOURCE=local
```

Nếu để `databricks` mà token vẫn là giá trị mẫu, Web UI sẽ cố đọc từ Databricks và báo lỗi kết nối. Đây là lỗi cấu hình, không phải lỗi mã nguồn.
Giá trị `local` đã được kiểm tra: API chấp nhận cấu hình tối thiểu chỉ gồm `KAFKA_BOOTSTRAP` và cặp `MINIO_*`.
Có file `.env` nhưng thiếu `LAKEHOUSE_DATA_SOURCE` thì mặc định của API là `local`.

**(c) Mật khẩu Gold PostgreSQL.** `GOLD_POSTGRES_PASSWORD=change-me-local` trong `.env.example` hoạt động, nhưng hãy đổi nếu máy bạn nằm trong mạng chung.
Nếu bỏ trống, Compose dùng mặc định `lakehouse-local`.

Bảng các nhóm biến trong `.env`:

| Nhóm | Biến chính | Ghi chú |
|---|---|---|
| Chung | `ENV=local`, `LOG_LEVEL=info` | `ENV` nhận `local`, `dev`, `staging`, `prod` |
| MinIO | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_SECURE` | Mặc định `localhost:9000`, `minioadmin`/`minioadmin`, `false` |
| Kafka | `KAFKA_BOOTSTRAP`, `KAFKA_SECURITY_PROTOCOL` | Từ host: `localhost:9092`. Trong Docker: `kafka:29092` |
| MongoDB | `MONGO_URI`, `MONGO_DB` | Xem lưu ý xác thực bên dưới |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Mặc định `localhost`, `6379`, trống |
| Airflow | `AIRFLOW_BASE_URL`, `AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD`, `AIRFLOW_FERNET_KEY` | Từ host dùng cổng 8088 |
| API | `API_PORT`, `API_RATE_LIMIT_PER_MIN`, `API_CORS_ORIGINS`, `API_SWAGGER_ENABLED` | |
| DuckDB | `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Mặc định `4GB`, `4` |
| Spark | `SPARK_MASTER`, `SPARK_DRIVER_MEMORY`, `SPARK_EXECUTOR_MEMORY`, `DELTA_PACKAGE`, `KAFKA_PACKAGE` | Compose ghi đè bộ nhớ cho container |
| Data Quality | `DQ_MAX_NULL_PERCENT`, `DQ_FAIL_ON_ERROR` | |
| Crawler | `TIKI_API_BASE`, `CRAWLER_RATE_LIMIT`, `CRAWLER_MAX_WORKERS`, `CRAWLER_TIMEOUT` | |
| Databricks | `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_HTTP_PATH`, `DATABRICKS_CATALOG`, `..._BRONZE/SILVER/GOLD_SCHEMA` | Chỉ cần khi dùng Databricks (mục 16) |
| R2 | `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Tùy chọn (mục 16) |
| Metabase | `METABASE_URL`, `METABASE_API_KEY` | Tùy chọn |
| Gold mirror | `GOLD_POSTGRES_USER`, `GOLD_POSTGRES_PASSWORD` | |

Cổng Airflow là điểm dễ nhầm. `.env.example` ghi `AIRFLOW_BASE_URL=http://localhost:8080/api/v1`, nhưng 8080 trên host là **Spark UI**.
Airflow nằm ở **8088**. Khi API chạy trên host, đặt `AIRFLOW_BASE_URL=http://127.0.0.1:8088/api/v1`.
Khi API chạy trong Docker, Compose tự ghi đè thành `http://airflow-webserver:8080/api/v1`.

### 9.2 Tạo `apps/api/.env.local`

File này cần cho cả `make up-api` (Compose đọc nó bằng `env_file`) lẫn chạy API trên host. Nếu thiếu, `docker compose ... -f docker-compose.dev-api.yml`
sẽ báo lỗi không tìm thấy file env.

```bash
cp apps/api/.env.example apps/api/.env.local
```

Rồi sửa các dòng sau trong `apps/api/.env.local`:

```dotenv
# 1) MongoDB trong Compose bật xác thực (user mongoadmin). URI không có tài khoản sẽ
#    kết nối được nhưng mọi lệnh bị từ chối với "requires authentication".
MONGO_URI=mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin
MONGO_DB=lakehouse_catalog

# 2) Từ host, Airflow nằm ở cổng 8088 (không phải 8080)
AIRFLOW_BASE_URL=http://127.0.0.1:8088/api/v1

# 3) Không có Databricks thì đọc từ MinIO
LAKEHOUSE_DATA_SOURCE=local
LAKEHOUSE_EXECUTION_TARGET=local_delta_minio

# 4) Địa chỉ trên host
MINIO_ENDPOINT=127.0.0.1:9000
KAFKA_BOOTSTRAP=127.0.0.1:9092
REDIS_HOST=127.0.0.1
```

Khi API chạy **trong Docker**, `docker-compose.dev-api.yml` tự ghi đè `MONGO_URI`, `REDIS_HOST`, `MINIO_ENDPOINT`,
`KAFKA_BOOTSTRAP`, `AIRFLOW_BASE_URL` sang tên service (`mongo`, `redis`, `minio`, `kafka:29092`, `airflow-webserver`),
nên các giá trị `127.0.0.1` ở trên chỉ phục vụ chạy API trên host.

Nếu bạn để `LAKEHOUSE_DATA_SOURCE=databricks`, schema kiểm tra bắt buộc có đủ `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`,
và `DATABRICKS_HTTP_PATH` phải kết thúc bằng đúng warehouse ID. Nếu không, API thoát ngay khi khởi động với danh sách lỗi
`Invalid environment variables`. Đã kiểm tra: thiếu cả `MINIO_*` lẫn `S3_*` cũng làm API từ chối khởi động.

Các biến xác thực của API (mặc định tắt, chỉ cần khi triển khai ngoài máy local): `API_AUTH_ENABLED` (mặc định `false`),
`API_JWT_SECRET` (tối thiểu 32 ký tự), `API_SERVICE_KEYS`, `API_USER_CREDENTIALS`. Xem mục 21.

### 9.3 `apps/web/.env` (không bắt buộc)

```bash
cp apps/web/.env.example apps/web/.env
```

Mặc định đủ dùng: `VITE_API_BASE_URL` để trống nên trình duyệt gọi cùng nguồn (`/api/...`), và Vite chuyển tiếp tới
`API_PROXY_TARGET=http://127.0.0.1:3001`. Chỉ đổi `API_PROXY_TARGET` nếu API chạy ở máy hoặc cổng khác.

### 9.4 Dùng Databricks thay vì MinIO (tùy chọn)

Xem mục 16. Mẫu `.env.databricks.template` dành cho trường hợp chạy Python trực tiếp trên Databricks (`ENV=databricks`),
không phải mẫu cho stack Docker local.

## 10. Cài dependency

### 10.1 Node (API, Web, workspace)

```bash
pnpm install --frozen-lockfile
```

Lệnh này cài cho cả `apps/api` (`lakehouse-api`) và `apps/web` (`@lakehouse/web`) theo `pnpm-workspace.yaml`.
`--frozen-lockfile` giữ đúng phiên bản trong `pnpm-lock.yaml` (CI cũng dùng cờ này). Cần Internet.

Kiểm tra: `pnpm -r exec node -v` in phiên bản Node cho từng app, và thư mục `node_modules/` xuất hiện.

Nếu `corepack` báo lỗi quyền hoặc không tìm thấy `pnpm`, cài trực tiếp: `npm install -g pnpm@9.15.9`.

### 10.2 Python (tùy chọn nhưng khuyến nghị)

Cần Python trên host để: chạy `make mock-retail`, crawler scheduler (`make scheduler`), `scripts/produce_kafka.sh`, `pytest`, `ruff`, `black`, `mypy`.
Stack Docker **không** cần bước này.

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows WSL và Linux cũng dùng đúng lệnh này
python -m pip install --upgrade pip
pip install -e ".[dev]"            # tương đương `make install` sau khi venv đã có
```

Lưu ý quan trọng: `Makefile` và các script (`produce_kafka.sh`, `run_crawl_scheduler.sh`) tìm thư mục tên **`.venv`**
(có dấu chấm). Repo cũng có thư mục `venv/` (không dấu chấm) từ lần cài trước và nó **không** được script dùng. Hãy tạo `.venv` như trên.

Gói `lakehouse` kéo theo `pyspark`, `delta-spark`, `great-expectations` và nhiều thư viện nặng nên bước này có thể mất vài phút.
Kiểm tra: `python -c "import lakehouse, pyspark, delta; print('ok')"`.

Ghi chú: bộ sinh dữ liệu giả (`lakehouse.sources.mock.retail_generator`) chỉ dùng thư viện chuẩn của Python và đã chạy được
trên Python 3.10 mà không cần cài gói nào.

## 11. Khởi động hạ tầng Docker

Có ba file Compose, ghép lại theo nhu cầu:

| File | Chứa gì | Khi nào dùng |
|---|---|---|
| `docker-compose.yml` | MinIO, minio-init, Postgres (metastore), Gold Postgres, Spark master/worker, Airflow (db, webserver, scheduler), Metabase, MongoDB, Redis | Luôn luôn |
| `docker-compose-kafka.yml` | ZooKeeper, Kafka, Kafka UI, kafka-init (tạo 7 topic) | Luôn luôn (`make up` đã gộp sẵn) |
| `docker-compose.dev-api.yml` | `api` (cổng 3001), `worker` (BullMQ), `web` (nginx, cổng 5173) | Khi muốn Control Plane |

Lệnh `make up` = core + Kafka. Lệnh `make up-api` = core + Kafka + Control Plane.

### 11.1 Chuẩn bị thư mục bind-mount

`data-samples/` (đầu vào) và `airflow_logs/` (log Airflow) được mount vào container nhưng không có trong Git.
Hãy tạo chúng bằng user của bạn **trước** khi chạy Docker:

```bash
mkdir -p data-samples airflow_logs
```

Nếu bỏ qua bước này trên Linux, Docker sẽ tự tạo hai thư mục với chủ sở hữu `root` và bạn không ghi được vào chúng từ host.

Chỉ Linux native: container Airflow chạy với uid 50000 (nhóm `root`) và ghi vào hai thư mục này.
Docker Desktop (macOS, Windows) tự xử lý quyền, còn Linux native thì không, nên cấp quyền ghi cho thư mục trên host.
Tôi chưa chạy thử bước này trên máy Linux:

```bash
chmod -R a+rwX data-samples airflow_logs      # cách đơn giản cho máy dev cá nhân
# hoặc chặt chẽ hơn: sudo chown -R 50000:0 airflow_logs data-samples
```

### 11.2 Build các image tùy biến

Repo tự build 3 image: `lake-airflow:2.7.0` (Airflow + JDK 17 + JAR Spark), `lake-spark:3.5.6` (Spark + venv Python), và `lake-worker`.
Image worker bắt đầu từ `FROM lake-airflow:2.7.0`, nên **`lake-airflow:2.7.0` phải có trước**. Hãy build theo thứ tự:

```bash
# Chỉ Mac Intel / Windows x64 / Linux x64: làm mục 7.5 trước bước này.
docker compose -f docker-compose.yml -f docker-compose-kafka.yml build airflow-webserver spark-master
```

Lần build đầu cần Internet (tải JDK từ GitHub, các JAR từ Maven Central, image gốc từ Docker Hub) và mất nhiều thời gian,
tùy đường truyền. Nếu bước tải JAR phụ báo `WARN: could not fetch ...` thì đó là JAR tùy chọn; lỗi dừng build mới là lỗi thật.

Máy ít RAM nên build **tuần tự** để tránh bị kill do hết bộ nhớ (mục 19.1):

```bash
export COMPOSE_PARALLEL_LIMIT=1
```

### 11.3 Khởi động core và Kafka

```bash
make up
```

Lệnh này chạy `docker compose -f docker-compose.yml -f docker-compose-kafka.yml up -d` rồi chờ 60 giây.
Nếu không dùng `make` (ví dụ Windows chưa cài `make`), chạy thẳng lệnh `docker compose` ở trên.

Thứ tự khởi động do `depends_on` và healthcheck quyết định: MinIO khỏe → `minio-init` tạo bucket;
ZooKeeper khỏe → Kafka khỏe → `kafka-init` tạo topic và Kafka UI; Airflow DB khỏe → webserver (chạy `airflow db init`,
tạo user `admin/admin`) khỏe → scheduler. Webserver mất khoảng 1 phút để lên (`start_period: 60s`).

### 11.4 Tạo bucket `lakehouse` (bắt buộc, dễ bị bỏ sót)

`minio-init` chỉ tạo các bucket `bronze`, `silver`, `gold` (và thư mục con `crm`, `erp`, `clickstream`, `ecommerce`).
Nhưng toàn bộ code Python và TypeScript ghi vào `s3a://lakehouse/{layer}/{database}/{table}`, tức bucket **`lakehouse`**.
Tôi đã tìm trong mã nguồn và Compose và **không thấy chỗ nào tự tạo bucket này**, nên trên máy mới bạn cần tạo thủ công
(nếu thiếu, job Spark sẽ lỗi `NoSuchBucket`). Lệnh dưới dùng chính image `minio-init` và an toàn khi chạy lại (`--ignore-existing`).
Đã chạy thử trên stack đang chạy:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml run --rm --no-deps --entrypoint /bin/sh minio-init \
  -c 'mc alias set local http://minio:9000 minioadmin minioadmin >/dev/null && mc mb --ignore-existing local/lakehouse && mc ls local/'
```

Cách khác: mở http://localhost:9001, đăng nhập `minioadmin/minioadmin`, chọn **Buckets → Create Bucket**, đặt tên `lakehouse`.

### 11.5 Kiểm tra stack đã lên

```bash
make ps                       # hoặc: docker compose -f docker-compose.yml -f docker-compose-kafka.yml ps
make health                   # chạy scripts/check_dev_links.sh, in ✓ hoặc ✗ cho từng dịch vụ
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list
```

Trạng thái mong đợi: các container `lake-minio`, `lake-postgres`, `lake-gold-postgres`, `lake-spark-master`, `lake-spark-worker`,
`lake-airflow-db`, `lake-airflow-webserver`, `lake-airflow-scheduler`, `lake-mongo`, `lake-redis`, `lake-zookeeper`, `lake-kafka`,
`lake-kafka-ui` đều `healthy` (hoặc `Up`). Danh sách topic phải có 7 topic: `clickstream-events`, `ecommerce-products-stream`,
`ecommerce-reviews-stream`, `ecommerce-price-stream`, `crypto-prices-stream`, `github-trending-stream`, `hackernews-stream`.

Nếu thiếu topic (container `lake-kafka-init` thoát với mã khác 0 vì Kafka chưa sẵn sàng lúc đó), chạy lại:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml up kafka-init
```

`make health` báo `metabase ... [optional]` màu vàng nếu Metabase chưa lên. Metabase mất tới 90 giây để khởi động lần đầu và không bắt buộc.

### 11.6 Bật DAG trong Airflow

Mặc định Airflow tạo DAG ở trạng thái **tạm dừng**. Trên stack tham chiếu, chỉ `retail_elt_dag` đã được bật, còn
`crawler_dag`, `clickstream_streaming_dag` và `ecommerce_streaming_dag` đang tạm dừng. DAG bị tạm dừng sẽ không chạy dù bạn bấm Trigger.

```bash
docker exec lake-airflow-webserver airflow dags list
docker exec lake-airflow-webserver airflow dags unpause retail_elt_dag
```

Hoặc dùng giao diện http://localhost:8088 (`admin/admin`), gạt công tắc ở cột đầu của từng DAG.

| DAG | Lịch | Việc làm |
|---|---|---|
| `retail_elt_dag` | không có lịch (chạy tay) | health check MinIO → 3 task Bronze → 3 task Silver → 4 task Gold (`fact_orders`, `dim_customers`, `dim_products`, `daily_revenue`) |
| `crawler_dag` | mỗi giờ | chạy crawler, ghi Delta qua `lake-spark-master` |
| `clickstream_streaming_dag` | mỗi giờ | `spark-submit` pipeline clickstream (Kafka → Delta) |
| `ecommerce_streaming_dag` | mỗi giờ | `spark-submit` pipeline ecommerce (Kafka → Delta) |

Các DAG này dùng `docker exec lake-spark-master spark-submit ...`, vì thế container Airflow mount Docker socket.
Trên Linux native xem mục 7.2 bước 5.

## 12. Chạy các pipeline dữ liệu

Điều kiện: đã xong mục 11 (stack lên, bucket `lakehouse` tồn tại). Các lệnh Spark chạy **bên trong** container `lake-spark-master`
qua `docker exec`, nên không cần Java hay Spark trên host.

### 12.1 Sinh dữ liệu mock (customers, products, orders)

```bash
make mock-retail
```

Hoặc không cần `make` và không cần cài gói nào (bộ sinh chỉ dùng thư viện chuẩn của Python, đã kiểm tra chạy trên Python 3.10):

```bash
PYTHONPATH=src python3 -m lakehouse.sources.mock.retail_generator
```

Kết quả mặc định (đã kiểm tra): **200 khách hàng, 50 sản phẩm, 1000 đơn hàng**, ghi vào:

```text
data-samples/crm/customers.csv
data-samples/erp/products.csv
data-samples/erp/orders.json
```

`make mock-retail` dùng `.venv/bin/python` nếu có, nếu không thì dùng `python3` hệ thống. Khi dùng `python3` hệ thống, gói `lakehouse`
chưa cài sẽ báo `No module named lakehouse`; hãy dùng lệnh `PYTHONPATH=src ...` ở trên hoặc cài venv ở mục 10.2.
Có thể đổi thư mục đầu ra bằng biến `DATA_SAMPLES_DIR`. Thư mục `data-samples/` bị `.gitignore`, mỗi máy tự sinh.

### 12.2 Pipeline batch Bronze → Silver → Gold

**Cách 1: một lệnh chạy cả ba tầng** (`PipelineBatchRetail` gồm 9 stage: 2 ingest, 3 transform, 4 aggregate):

```bash
make pipeline-batch
# tương đương: bash scripts/run_batch_pipeline.sh --pipeline batch_retail
```

Xem trước lệnh sẽ chạy mà không thực thi:

```bash
bash scripts/run_batch_pipeline.sh --pipeline batch_retail --dry-run
```

Lần đầu `spark-submit` tải các gói `delta-spark`, `hadoop-aws`, `aws-java-sdk-bundle` từ Maven Central vào `/tmp/.ivy2`
của container nên cần Internet và chậm hơn các lần sau.

**Cách 2: từng tầng riêng:**

```bash
make pipeline-bronze     # nạp CSV vào Bronze (script csv_ingestor)
make pipeline-silver     # CHỈ transform customers
make pipeline-gold       # CHỈ aggregate fact_orders
```

Hai target `pipeline-silver` và `pipeline-gold` trong Makefile chỉ chạy **một** transformer/aggregator
(`customers_transformer.py`, `fact_orders_aggregator.py`), không phải toàn bộ tầng. Muốn đủ cả tầng, dùng Cách 1 hoặc Cách 3.
Hai target này cũng chỉ truyền gói `delta-spark` cho `spark-submit`, trong khi `run_batch_pipeline.sh` truyền thêm `hadoop-aws` và
`aws-java-sdk-bundle` (cần cho S3A). Nếu `make pipeline-silver` hoặc `make pipeline-gold` lỗi khi đọc/ghi S3, hãy chuyển sang Cách 1
(`bash scripts/run_batch_pipeline.sh --pipeline batch_retail`).

**Cách 3: qua Airflow** (có đồ thị phụ thuộc, retry, log từng task):

```bash
docker exec lake-airflow-webserver airflow dags unpause retail_elt_dag
make airflow-trigger          # = airflow dags trigger retail_elt_dag
```

Theo dõi tại http://localhost:8088 (tab Graph hoặc Grid). Đồ thị phụ thuộc của `retail_elt_dag`:

```text
health_check >> [bronze_ingest_customers, bronze_ingest_products, bronze_ingest_json]
bronze_ingest_customers >> silver_customers >> gold_dim_customers
bronze_ingest_products  >> silver_products  >> gold_dim_products
bronze_ingest_json      >> silver_orders    >> gold_daily_revenue
[silver_customers, silver_products, silver_orders] >> gold_fact_orders
```

DAG này không có lịch (`schedule_interval=None`), chỉ chạy khi bạn trigger. Airflow được cấu hình `AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG=1`
trong `docker-compose.yml`, nghĩa là mỗi DAG chỉ chạy một task tại một thời điểm để tránh hết bộ nhớ, nên chậm hơn Cách 1.

### 12.3 Kiểm tra dữ liệu đã vào lake

```bash
make pipeline-verify            # scripts/verify_lake_data.sh: số dòng từng tầng
bash scripts/verify_phase3.sh   # kiểm tra dữ liệu batch sau pipeline (cần stack đang chạy)
```

Hoặc duyệt trực tiếp trong MinIO Console (http://localhost:9001 → bucket `lakehouse` → `bronze/`, `silver/`, `gold/`).
Mã thoát của `verify_phase3.sh`: `0` đạt, `1` có kiểm tra thất bại, `2` stack chưa chạy.

Tài liệu này không nêu số dòng kỳ vọng cho Bronze/Silver/Gold. Nguồn vào mặc định là 200 khách hàng, 50 sản phẩm, 1000 đơn hàng;
số dòng ở Silver và Gold phụ thuộc vào phép làm sạch và khử trùng lặp, nên hãy đối chiếu với kết quả của `make pipeline-verify` trên máy bạn.

### 12.4 Streaming với Kafka

Đẩy sự kiện thử vào topic (script dùng `kafka-python` trong `.venv`, nên cần mục 10.2):

```bash
make produce-clickstream                          # 100 sự kiện vào clickstream-events, 10 msg/s
bash scripts/produce_kafka.sh clickstream-events 500 20
bash scripts/produce_kafka.sh ecommerce-products-stream 50 5
```

Từ host, `KAFKA_BOOTSTRAP` mặc định là `localhost:9092`. Chạy pipeline streaming Kafka → Delta bằng Spark Structured Streaming:

```bash
make stream-clickstream
make stream-ecommerce
make aggregate-clickstream-unique     # tính lại chỉ số unique chính xác theo lô
```

Pipeline streaming dùng `trigger_available_now`: nó xử lý toàn bộ bản ghi đang có trong topic rồi **tự dừng**, không chạy vô hạn.
Muốn chạy định kỳ, bật `clickstream_streaming_dag` và `ecommerce_streaming_dag` trong Airflow (chạy mỗi giờ).

Xem topic, message và consumer group tại Kafka UI http://localhost:8081, hoặc trong màn hình Kafka của Web UI.

### 12.5 Crawler

Hai cách: chạy crawler lẻ, hoặc chạy scheduler nhiều job. Cả hai cần `.venv` (mục 10.2), Kafka đang chạy và Internet.

```bash
make crawl-tiki                    # Tiki, danh mục smartphone, 5 trang
make crawl-all                     # GitHub trending, Crypto, HackerNews
make scheduler-list                # liệt kê job đã cấu hình
make scheduler-once NAME=tiki-smartphone
make scheduler-daemon              # chạy nền, log tại /tmp/crawl_scheduler.log
make scheduler-stop
```

Scheduler mặc định có **8 job**: 5 job Tiki (`tiki-smartphone`, `tiki-laptop`, `tiki-fashion`, `tiki-beauty`, `tiki-home-appliance`, mỗi 6 giờ),
`github-trending` (mỗi 1 giờ), `hackernews-top` (mỗi 30 phút), `crypto-top-50` (mỗi 5 phút).
Dòng chú thích `make scheduler` trong Makefile ghi "all 11 jobs" là cũ; theo `build_default_scheduler()` trong `src/lakehouse/sources/scheduler.py`
số job thực tế là 8 (5 Tiki + 1 GitHub + 1 HackerNews + 1 Crypto).

Crawler cần Kafka truy cập được vì mỗi crawler tạo `KafkaProducer` khi khởi tạo. Nếu Kafka tắt hoặc `KAFKA_BOOTSTRAP` sai,
`kafka-python` thường báo lỗi `NoBrokersAvailable`.
Từ host dùng `localhost:9092`; từ bên trong container dùng `kafka:29092`.

Trong Web UI, màn hình **Crawler** điều khiển bốn crawler: `tiki`, `github`, `crypto`, `hackernews` (chạy, chạy bất đồng bộ, dừng, xem lịch sử).
Các lần chạy này đi qua hàng đợi BullMQ và cần container `worker` đang chạy (mục 13).

### 12.6 Đồng bộ Gold sang PostgreSQL cho Metabase

```bash
bash scripts/sync_gold_to_metabase.sh
```

Chạy sau khi tầng Gold có dữ liệu và sau mỗi lần làm mới Gold. Chi tiết ở mục 15.

### 12.7 Demo không cần Docker (tùy chọn)

```bash
make demo
```

Chạy Bronze → Silver → Gold ngay trên host (`experiments.demo_local_pipeline`), không cần MinIO, Airflow hay Kafka. Cần Java 11 trở lên
(dự án dùng Java 17) và gói Python `lakehouse` (mục 7 và 10.2).
Có thêm `make experiment-01`, `experiment-02`, `experiment-03` (schema evolution và time travel, so sánh ETL/ELT, benchmark hiệu năng).

## 13. Chạy Control Plane (API và Web)

Có hai cách. Người mới nên dùng **Cách A**.

### 13.1 Cách A: chạy trong Docker (khuyến nghị)

Điều kiện: đã có `.env` (9.1), `apps/api/.env.local` (9.2), và image `lake-airflow:2.7.0` (11.2).

```bash
# Build tuần tự, ít tốn RAM. Image worker cần lake-airflow:2.7.0 có sẵn.
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml build api worker web

# Khởi động core + Kafka + api + worker + web
make up-api
```

Build image `api` chạy `next build` và dùng nhiều RAM. Dockerfile đã giới hạn `NEXT_BUILD_CPUS=2` để tránh bị kill do hết bộ nhớ.
Nếu Docker được cấp ít RAM (dưới khoảng 8 GB), build vẫn có thể bị kill với mã thoát 137 (xem mục 19.1).

Thứ tự phụ thuộc (theo `docker-compose.dev-api.yml`): `api` chờ `mongo` khởi động, và `redis`, `minio`, `airflow-webserver` ở trạng thái healthy;
`worker` chờ `mongo` khởi động, `redis` và `minio` healthy; `web` chờ `api` khởi động.
Vì `api` đợi Airflow, lần khởi động đầu mất từ 1 đến vài phút.

Kiểm tra:

```bash
curl -s localhost:3001/api/health            # {"data":{"status":"ok", ...}}
curl -s localhost:3001/api/health/deep       # kiểm tra sâu Mongo, Redis, DuckDB, MinIO, Kafka, Airflow
curl -s -o /dev/null -w "%{http_code}\n" localhost:5173
docker ps --filter name=lake-api --filter name=lake-worker --filter name=lake-web
```

Mở Web UI: http://localhost:5173. Swagger: http://localhost:3001/api-doc.

Container `lake-worker` không có healthcheck nên trạng thái hiển thị là `Up` chứ không phải `healthy`. Đây là bình thường.
Worker là tiến trình tiêu thụ hàng đợi BullMQ. **Nếu worker không chạy, job Bronze/Silver/Gold/Crawler nộp qua API sẽ nằm mãi ở trạng thái `queued`.**

Dừng:

```bash
make down-api        # giữ nguyên dữ liệu (volume)
```

### 13.2 Cách B: API trên host, Web trên host (phát triển có hot reload)

Phù hợp khi bạn sửa code TypeScript và muốn thấy kết quả ngay.

1. Dừng các container Control Plane để không tranh cổng 3001 và 5173:

```bash
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml stop api web
```

Giữ nguyên container `worker` chạy. Worker trong Docker đã có sẵn Python, JDK 17 và Spark, nên API trên host chỉ cần nộp job qua Redis.
Nếu bạn tự chạy worker trên host, máy phải có Java 17 và `pip install -e .`, đồng thời đặt `LAKEHOUSE_PYTHON=$(pwd)/.venv/bin/python`.

2. Chạy API (không kèm worker):

```bash
pnpm --filter lakehouse-api dev:api       # next dev -p 3001
```

3. Mở terminal thứ hai, chạy Web:

```bash
pnpm --filter @lakehouse/web dev          # vite, cổng 5173 (strictPort)
```

Vite chuyển tiếp mọi yêu cầu `/api/...` tới `API_PROXY_TARGET` (mặc định `http://127.0.0.1:3001`).
Cổng 5173 được đặt `strictPort: true` nên nếu bị chiếm, Vite thoát chứ không đổi cổng.

Lệnh `pnpm dev` ở thư mục gốc chạy song song cả API **và** worker **và** Web (`next dev` + `tsx src/workers/main.ts` + `vite`).
Chỉ dùng khi máy host đã có Java 17 và Python đã cài `lakehouse`, và bạn đã dừng container `worker` để tránh hai worker cùng tiêu thụ một hàng đợi.

Trước khi chạy API trên host, kiểm tra cấu hình: `cd apps/api && pnpm run env:check`.

Hai script `scripts/dev-api.sh` và `scripts/dev-web.sh` hiện **không dùng được**: chúng tính thư mục gốc bằng `$SCRIPT_DIR/../..`
(`scripts/` đi lên hai cấp sẽ ra ngoài thư mục repo) nên `cd "$REPO_ROOT/apps/api"` trỏ sai chỗ. Hãy dùng lệnh `pnpm` ở trên.

## 14. Tính năng của Control Plane

Web UI (http://localhost:5173) có 12 màn hình, khai báo trong `apps/web/src/App.tsx` và `apps/web/src/navigation/routes.ts`.
Giao diện có hai ngôn ngữ (`en.json`, `vi.json` trong `apps/web/src/i18n/locales`).

| Đường dẫn | Màn hình | Mục đích |
|---|---|---|
| `/` | Home | Tổng quan hệ thống, hoạt động gần đây, phụ thuộc giữa các thành phần |
| `/catalog` | Catalog | Duyệt database/bảng, schema, mẫu dữ liệu, thống kê, lineage, tìm kiếm, đồng bộ metadata |
| `/bronze` | Bronze | Nạp CSV/JSON/Kafka vào Bronze, xem bảng, partition, lịch sử Delta, vacuum, theo dõi job |
| `/silver` | Silver | Chạy transform, xem bảng, lịch sử, time travel, diff giữa hai phiên bản |
| `/gold` | Gold | Chạy aggregate, xem bảng, truy vấn nghiệp vụ dựng sẵn và truy vấn ad-hoc |
| `/crawler` | Crawler | Điều khiển crawler `tiki`, `github`, `crypto`, `hackernews` |
| `/kafka` | Kafka | Cluster, topic, consumer group, đọc và ghi message |
| `/airflow` | Airflow | Danh sách DAG, bật/tắt, trigger, run, task, biểu đồ Gantt |
| `/dq` | Data Quality | Tạo và chạy rule, preset, bộ kiểm tra, tổng hợp kết quả |
| `/eda` | EDA | Profile dữ liệu, thống kê cột, biểu đồ, so sánh, đề xuất rule DQ |
| `/health` | Health | Trạng thái từng dịch vụ, kiểm tra nhanh và kiểm tra sâu |
| `/schematic` | Schematic | Sơ đồ kiến trúc tương tác (Three.js) |

Mọi đường dẫn khác chuyển về `/`.

### 14.1 Nhóm API

Thư mục `apps/api/src/app/api` có các nhóm route sau. Tài liệu đầy đủ và chạy thử nằm ở Swagger http://localhost:3001/api-doc
(đường dẫn `/api/docs` chuyển hướng về đó). Bảng dưới liệt kê nhóm, không liệt kê từng endpoint.

| Nhóm | Chức năng chính |
|---|---|
| `/api/health`, `/api/health/deep`, `/api/info` | Sức khỏe nhanh và sâu (Mongo, Redis, DuckDB, MinIO, Kafka, Airflow, Databricks nếu bật), thông tin ứng dụng |
| `/api/dashboard/*` | `summary`, `activity`, `dependencies` cho màn hình Home |
| `/api/catalog/*` | databases, tables, schemas, search, lineage, sample, stats, sync |
| `/api/bronze/*` | nạp `csv`, `json`, `stream/{topic}`; bảng, partition, history, vacuum, jobs |
| `/api/silver/*` | transform từng bảng hoặc `transform/all`, history, time-travel, diff, jobs |
| `/api/gold/*` | aggregate từng bảng hoặc `aggregate/all`, queries (`business-metrics`, `category-revenue`, `customer-analytics`, `product-performance`, `ad-hoc`), jobs |
| `/api/crawler/*` | danh sách, cấu hình, preview, run, run-async, stop, runs, kafka-topic, stats |
| `/api/kafka/*` | cluster, stats, topics, produce, produce-batch, messages, consumer-groups, lag, reset-offset |
| `/api/airflow/*` | health, stats, dags, pause/unpause, trigger, runs, tasks, gantt |
| `/api/dq/*` | rules, presets, run-suite, runs, summary |
| `/api/eda/*` | profiles, columns, charts, sample, compare, propose-rule |
| `/api/operations/*` | danh sách thao tác, chi tiết, events, cancel, retry |
| `/api/auth/login`, `/api/auth/confirm`, `/api/users`, `/api/audit` | đăng nhập, token xác nhận thao tác nguy hiểm, quản lý người dùng, nhật ký kiểm toán |

### 14.2 Job bất đồng bộ và hàng đợi

Các thao tác nặng (nạp Bronze, transform Silver, aggregate Gold, chạy crawler) không chạy trong tiến trình API.
API ghi một job vào MongoDB và đẩy vào hàng đợi BullMQ (Redis). Container `lake-worker` nhận job và chạy `python -m lakehouse.jobs.runner`.
Hệ quả: nếu `lake-worker` không chạy hoặc Redis không lên, job sẽ nằm ở trạng thái `queued`. Kiểm tra bằng:

```bash
docker logs --tail 50 lake-worker
curl -s localhost:3001/api/health/deep
```

### 14.3 Data Quality

Loại rule được hỗ trợ (`apps/api/src/modules/dq/types/dq.enum.ts`): `null_check`, `range_check`, `in_set`, `unique`, `regex`, `custom_sql`.
Rule áp dụng cho một trong ba tầng `bronze`, `silver`, `gold`. Mức độ nghiêm trọng: `low`, `medium`, `high`, `critical`.

Kết quả một lần chạy là `pass`, `fail`, `warn`, `error` hoặc `not_evaluated`. Lỗi kỹ thuật được ghi là `error`, không bị tính là đạt hay hỏng.
Chưa có rule hoặc chưa chạy thì trạng thái là `not_evaluated`, không được hiển thị như tỷ lệ đạt 100%.

Dịch vụ DQ có sẵn các preset, ví dụ `bronze-orders-not-null`, `bronze-events-no-totally-empty`, `silver-dedupe-by-id`, `silver-status-in-set`,
`gold-amount-range`, `gold-email-regex`. Danh sách đầy đủ lấy từ `GET /api/dq/presets`.

### 14.4 EDA

Màn hình EDA tạo profile cho một bảng và cho phép xem thống kê từng cột, mẫu dữ liệu và biểu đồ, so sánh hai profile, và đề xuất rule DQ
từ kết quả profile (`/api/eda/propose-rule`). Có hai engine: `local-profile.engine` (DuckDB trên dữ liệu MinIO) và `databricks-profile.engine`
(khi `LAKEHOUSE_DATA_SOURCE=databricks`).

### 14.5 Airflow, Kafka, Crawler trong UI

- Airflow: API gọi REST của Airflow tại `AIRFLOW_BASE_URL` với tài khoản `AIRFLOW_USERNAME` / `AIRFLOW_PASSWORD` (mặc định `admin` / `admin`).
  Từ host dùng `http://127.0.0.1:8088/api/v1`; container `api` dùng `http://airflow-webserver:8080/api/v1`.
- Kafka: dùng `kafkajs`. Từ host dùng `localhost:9092`; container dùng `kafka:29092`.
- Crawler: cấu hình crawler lưu trong MongoDB, mỗi lần chạy có `runId` với trạng thái `queued`, `running`, `success`, `failed`, `partial`, `cancelled`.

## 15. Metabase và Gold PostgreSQL

Metabase (http://localhost:3000) không đọc trực tiếp Delta trên MinIO. Dự án sao chép (mirror) các bảng Gold sang PostgreSQL `lake-gold-postgres`,
rồi Metabase kết nối vào đó.

### 15.1 Đồng bộ dữ liệu

```bash
bash scripts/sync_gold_to_metabase.sh
```

Script chạy `spark-submit` trong container Spark với gói `org.postgresql:postgresql:42.7.4`, đọc bốn bảng Gold và ghi vào schema `public`
của database `gold_analytics`:

- `fact_orders`
- `daily_revenue`
- `dim_customers`
- `dim_products`

Mỗi lần chạy **ghi đè** (`overwrite`) toàn bộ bốn bảng. Nếu một bảng Gold chưa tồn tại, script dừng với lỗi `Gold Delta table ... was not found`.
Vì vậy phải chạy pipeline batch (mục 12.2) trước. Script từ chối chạy khi `LAKEHOUSE_DATA_SOURCE=databricks`.

### 15.2 Kết nối trong Metabase

Lần đầu mở http://localhost:3000, Metabase hiện trình hướng dẫn tạo tài khoản quản trị. Metabase lưu dữ liệu của nó (H2) trong volume riêng,
nên tài khoản này do bạn tự đặt, không có sẵn.

Sau đó thêm database loại **PostgreSQL**:

| Trường | Giá trị khi Metabase chạy trong Docker (cùng mạng Compose) |
|---|---|
| Host | `gold-postgres` |
| Port | `5432` |
| Database name | `gold_analytics` |
| Username | giá trị `GOLD_POSTGRES_USER` trong `.env` (mặc định `metabase`) |
| Password | giá trị `GOLD_POSTGRES_PASSWORD` trong `.env` |

Nếu bạn dùng công cụ SQL trên máy host (DBeaver, `psql`), kết nối tới `localhost` cổng `5433` với cùng database, user và mật khẩu.

Kiểm tra nhanh dữ liệu đã được sao chép:

```bash
docker exec lake-gold-postgres psql -U metabase -d gold_analytics -c "\dt"
```

(đổi `metabase` nếu bạn đã đổi `GOLD_POSTGRES_USER`).

### 15.3 Chia sẻ dashboard

`docs/METABASE_SHARING.md` mô tả cách chia sẻ: link `localhost` chỉ dùng được trên máy chạy Docker, nên muốn người khác xem qua Internet
hãy dùng Cloudflare Tunnel kèm Access, tạo user Metabase riêng cho người xem, và **không** mở trực tiếp cổng 3000 ra Internet.

## 16. Databricks và Cloudflare R2 (tùy chọn)

Mặc định dự án chạy hoàn toàn cục bộ (`LAKEHOUSE_DATA_SOURCE=local`). Hai phần dưới đây là tùy chọn và cần tài khoản bên ngoài.
Phần này mô tả cấu hình theo file mẫu trong repo; tôi không chạy thử với workspace Databricks hay bucket R2 thật.

### 16.1 Databricks

1. Lấy `DATABRICKS_HOST` (URL workspace), `DATABRICKS_TOKEN` (User Settings → Developer → Access tokens) và `DATABRICKS_WAREHOUSE_ID`
   (SQL Warehouses → chọn warehouse → copy ID).
2. Điền vào `.env` (xem `.env.databricks.template` và khối Databricks trong `.env.example`):

```bash
LAKEHOUSE_DATA_SOURCE=databricks
DATABRICKS_HOST=https://<workspace>.cloud.databricks.com
DATABRICKS_TOKEN=<token-cua-ban>
DATABRICKS_WAREHOUSE_ID=<warehouse-id>
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/<warehouse-id>
DATABRICKS_CATALOG=workspace
DATABRICKS_BRONZE_SCHEMA=bronze
DATABRICKS_SILVER_SCHEMA=silver
DATABRICKS_GOLD_SCHEMA=gold
```

3. Dùng các lệnh hỗ trợ:

```bash
ENV=databricks make databricks-dryrun   # in cấu trúc lưu trữ đã phân giải (bắt buộc đặt ENV, ví dụ ENV=local hoặc ENV=databricks)
make databricks-diag        # kiểm tra xác thực với DATABRICKS_HOST (không in token)
make databricks-bootstrap   # tạo catalog, 3 schema và 4 volume trong Unity Catalog
```

Khi `LAKEHOUSE_DATA_SOURCE=databricks`, API đọc dữ liệu qua SQL Warehouse, và `/api/health/deep` có thêm mục Databricks
(`up` khi warehouse ở trạng thái `RUNNING`, ngược lại `degraded`). Script `sync_gold_to_metabase.sh` không dùng được ở chế độ này.
Hướng dẫn chi tiết: `docs/operations/DATABRICKS_SETUP.md`.

Quan trọng: token Databricks là bí mật. Chỉ để trong `.env` (đã được git bỏ qua), không dán vào chat, issue hay commit. Nếu lỡ lộ, hãy thu hồi token ngay.

### 16.2 Cloudflare R2

R2 dùng làm lưu trữ lạnh/sao lưu. Điền vào `.env`:

```bash
R2_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET=lakehouse-cold
```

Kiểm tra Spark cục bộ ghi/đọc được một bảng Delta tạm trên R2:

```bash
make verify-r2
```

Hướng dẫn chi tiết: `docs/cloud/r2/SETUP.md`, `docs/cloud/r2/SPARK_CONFIG.md`, `docs/operations/R2_SETUP.md`.

## 17. Kiểm thử và kiểm tra chất lượng

### 17.1 Python (thư mục gốc)

Cần `.venv` đã cài `pip install -e ".[dev]"` (mục 10.2).

```bash
make test         # pytest kèm coverage (cấu hình trong pyproject.toml)
make test-fast    # pytest không coverage
make lint         # ruff check src tests
make format       # black + ruff --fix (có sửa file)
make typecheck    # mypy src
make check        # cổng nhanh kiểu CI: ruff + black --check + pytest, không sửa file
make verify       # kiểm tra đầy đủ: lint, format, test và scripts/verify.sh
```

Python tối thiểu 3.10 (`requires-python = ">=3.10"`), độ dài dòng 100.
Một số test cần PySpark và Java 17; nếu thiếu, hãy cài như mục 7 và 10.2 hoặc chạy lại sau khi môi trường đủ.

### 17.2 Control Plane API (Vitest)

```bash
pnpm --filter lakehouse-api typecheck
pnpm --filter lakehouse-api test
pnpm --filter lakehouse-api lint      # next lint; có thể hỏi cấu hình ESLint nếu repo chưa có
```

Thư mục `apps/api/tests` có `unit/` và `integration/` (Airflow, Bronze, Gold, Catalog, Crawler, DQ, EDA, Kafka, Databricks, health và nhiều nhóm khác).

### 17.3 Web (Vitest và Playwright)

```bash
pnpm --filter @lakehouse/web typecheck
pnpm --filter @lakehouse/web test
pnpm --filter @lakehouse/web test:e2e
```

Playwright (`apps/web/playwright.config.ts`) tự khởi động Vite trên `127.0.0.1:5174` và có thể đổi bằng biến `BROWSER_BASE_URL`.
Lần đầu chạy e2e có thể cần tải trình duyệt: `pnpm --filter @lakehouse/web exec playwright install`.
Các spec nằm ở `apps/web/e2e`.

### 17.4 Kiểm tra tích hợp nhanh

```bash
make health                         # scripts/check_dev_links.sh: dò các cổng và endpoint
node scripts/verify-control-plane.mjs
```

`make health` chia cổng theo mức `critical` (MinIO, Spark Master, Kafka UI, Airflow) và `optional` (API, Web, MongoDB, Redis, Metabase).

`scripts/verify-control-plane.mjs` gọi 23 endpoint `GET` của API (health, catalog, bronze/silver/gold, crawler, kafka, airflow, dq), in mã HTTP từng endpoint,
ghi kết quả vào `test-results/api-results.json` và thoát với mã 1 nếu có endpoint lỗi hoặc không trả 200. API mặc định ở `http://127.0.0.1:3001`,
đổi bằng biến `API_VERIFY_URL`. Script không gửi token, nên khi `API_AUTH_ENABLED=true` các endpoint cần xác thực sẽ trả 401 (mục 21).

## 18. Vận hành hằng ngày

| Việc cần làm | Lệnh |
|---|---|
| Khởi động hạ tầng (core + Kafka) | `make up` |
| Khởi động kèm API, worker, web | `make up-api` |
| Xem trạng thái container | `make ps` |
| Xem log tất cả dịch vụ | `make logs` |
| Xem log một dịch vụ | `docker logs -f --tail 100 lake-api` (hoặc `lake-worker`, `lake-airflow-scheduler`, `lake-kafka`) |
| Kiểm tra cổng và endpoint | `make health` |
| Dừng, giữ dữ liệu | `make down` hoặc `make down-api` |
| Mở PySpark shell | `make spark-shell` |
| Xóa `__pycache__` | `make clean-pyc` |

`make up` và `make up-api` đều chờ cố định 60 giây (`sleep 60`) rồi mới trả quyền điều khiển; dịch vụ có thể cần thêm thời gian để healthy.
Dùng `make ps` để xác nhận trước khi chạy pipeline.

Dữ liệu nằm trong Docker volume nên `make down` không làm mất dữ liệu MinIO, MongoDB, Postgres, Kafka.

### 18.1 Đặt lại toàn bộ (nguy hiểm)

```bash
make reset
```

Lệnh này chạy `scripts/reset.sh`, hỏi xác nhận hai bước (bước hai phải gõ `RESET`), rồi **xóa mọi Docker volume** của stack
(`docker compose ... down -v`: MinIO, Postgres, Airflow DB, Kafka, MongoDB, Redis, ...) và `data-samples/*`. Không thể hoàn tác.
Chỉ dùng khi bạn muốn bắt đầu lại từ trạng thái sạch. Sau đó làm lại từ mục 11.4 (tạo bucket `lakehouse`) và mục 12.

`make clean` chỉ là bí danh cũ của `make reset`, đừng gõ nhầm khi chỉ muốn dọn file tạm.

## 19. Xử lý sự cố

Mỗi mục ghi triệu chứng, nguyên nhân và cách xử lý. Các nguyên nhân về bộ nhớ Airflow và ZooKeeper lấy từ chú thích trong
`docker-compose.yml` và `docker-compose-kafka.yml`; các lỗi còn lại là lỗi thường gặp với các công cụ này.

### 19.1 Build image bị kill, mã thoát 137, hoặc máy đứng

Nguyên nhân: `next build` và build image Airflow dùng nhiều RAM; Docker VM bị cạn bộ nhớ.

- Tăng RAM cho Docker (Docker Desktop → Settings → Resources; trên WSL2 sửa `%UserProfile%\.wslconfig`, mục 7.3). Nên từ 8 GB trở lên.
- Build tuần tự: `export COMPOSE_PARALLEL_LIMIT=1`, và build từng image một (`docker compose ... build api`, rồi `worker`, rồi `web`).
- Dockerfile của API đã đặt `NEXT_BUILD_CPUS=2`. Không nên tăng giá trị này khi RAM thấp.
- Tắt bớt ứng dụng nặng trong lúc build.

### 19.2 `Cannot connect to the Docker daemon` hoặc `permission denied` với `/var/run/docker.sock`

- macOS/Windows: mở Docker Desktop và chờ biểu tượng báo "running".
- Linux: thêm user vào nhóm `docker` rồi đăng nhập lại (mục 7.2): `sudo usermod -aG docker "$USER"`, sau đó đăng xuất và đăng nhập, hoặc chạy `newgrp docker`.
- WSL2: bật WSL integration cho distro trong Docker Desktop → Settings → Resources → WSL integration.

### 19.3 Cổng đã bị chiếm (`port is already allocated`, `address already in use`)

Tìm tiến trình đang giữ cổng, ví dụ cổng 3001:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN          # macOS, Linux
```

Windows PowerShell: `Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess`, rồi `Get-Process -Id <PID>`.

Các va chạm thường gặp:

- 8080 là Spark Master UI, còn Airflow ở host là **8088**. Đừng đặt `AIRFLOW_BASE_URL` về cổng 8080 khi chạy API trên host.
- Gold PostgreSQL publish ra host ở cổng 5433. Hai Postgres còn lại (`lake-postgres`, `lake-airflow-db`) không publish cổng ra host, nên không va chạm với Postgres cài sẵn trên máy.
- 3000 là Metabase; 3001 là API; 5173 là Web (Vite đặt `strictPort`, nên bị chiếm là thoát luôn).
- 27017 (MongoDB), 6379 (Redis) có thể trùng với dịch vụ cài sẵn trên máy. Dừng dịch vụ đó hoặc đổi cổng publish trong file Compose.

Nếu `make up-api` chạy cùng lúc với `pnpm dev` trên host, hai bên sẽ tranh cổng 3001 và 5173. Chỉ chọn một cách (mục 13).

### 19.4 Airflow không khởi động: `Fernet key must be 32 url-safe base64-encoded bytes`

`.env.example` có giá trị giữ chỗ `AIRFLOW_FERNET_KEY=generate-a-fernet-key`, Airflow không chấp nhận. Sinh khóa thật (mục 9.1):

```bash
openssl rand -base64 32 | tr '+/' '-_'
```

Dán vào `AIRFLOW_FERNET_KEY` trong `.env`, rồi `docker compose ... up -d airflow-webserver airflow-scheduler`.

### 19.5 Build `lake-airflow` lỗi checksum hoặc `exec format error` trên máy x64

`Dockerfile.airflow` đang cố định URL và SHA-256 của JDK **aarch64**. Trên Mac Intel, Windows x64 và Linux x64 phải đổi sang bản x64
theo mục 7.5. Triệu chứng là tải JDK xong báo sai checksum, hoặc chạy Java báo `exec format error`.

### 19.6 Spark/Airflow báo `Connection refused` hoặc `Py4JNetworkError: Answer from Java side is empty`

Nguyên nhân thường gặp: JVM bị kernel kill do hết bộ nhớ (OOM). Ba task Bronze của `retail_elt_dag` khởi động cùng lúc, mỗi task có một Spark driver.
Compose đã đặt `SPARK_DRIVER_MEMORY=768m`, `SPARK_EXECUTOR_MEMORY=768m`, `SPARK_MASTER=local[2]` và `MAX_ACTIVE_TASKS_PER_DAG=1` để giữ trong giới hạn.

- Tăng RAM cho Docker VM (mục 19.1).
- Đừng nâng `SPARK_DRIVER_MEMORY` lên cao nếu RAM chưa tăng.
- Xem log task: Airflow UI → DAG → Grid → chọn task → Logs; hoặc `docker logs lake-airflow-scheduler`.
- Kiểm tra container có bị OOM không: `docker inspect lake-airflow-scheduler --format '{{.State.OOMKilled}}'`.

### 19.7 Pipeline lỗi vì bucket hoặc đường dẫn S3 không tồn tại

Nếu thấy lỗi kiểu `NoSuchBucket` hoặc `The specified bucket does not exist`: `minio-init` chỉ tạo `bronze`, `silver`, `gold`, còn đường dẫn
`s3a://lakehouse/...` cần bucket `lakehouse`. Tạo theo mục 11.4 rồi chạy lại pipeline.

### 19.8 API báo lỗi MongoDB: `Authentication failed` hoặc `command ... requires authentication`

MongoDB trong Compose bật xác thực với user `mongoadmin`. `MONGO_URI` trong file mẫu không có thông tin đăng nhập. Dùng dạng
`mongodb://mongoadmin:<mat-khau>@127.0.0.1:27017/?authSource=admin` và đặt mật khẩu khớp với Compose (mục 9.2).
Sau khi sửa `apps/api/.env.local`, khởi động lại API.

### 19.9 Job Bronze/Silver/Gold/Crawler nằm mãi ở `queued`

API chỉ nộp job; `lake-worker` mới là bên chạy. Kiểm tra:

```bash
docker ps --filter name=lake-worker
docker logs --tail 100 lake-worker
docker exec lake-redis redis-cli ping           # kỳ vọng: PONG
```

Nếu worker không chạy, `make up-api` (hoặc `docker compose ... up -d worker`). Nếu bạn chạy API trên host (mục 13.2) mà không có worker nào
tiêu thụ cùng hàng đợi Redis thì job cũng không bao giờ chạy.

### 19.10 Kafka không lên: `InconsistentClusterIdException`

Nguyên nhân: ZooKeeper lưu cluster ID, còn volume dữ liệu của Kafka lưu ID cũ trong `meta.properties`. Hai bên lệch nhau khi một trong hai volume bị tạo lại.
Compose hiện dùng volume ZooKeeper có phiên bản (`zookeeper_data_v2`, `zookeeper_log_v2`) để các lần `down` rồi `up` thường không làm lệch.

Cách xử lý an toàn nhất: giữ nguyên cả hai volume, chạy `docker compose ... up -d` bình thường. Nếu đã lệch và bạn chấp nhận mất toàn bộ topic, offset và message,
mới cân nhắc xóa **cả** volume ZooKeeper lẫn Kafka cùng lúc. Việc này không thể hoàn tác; không làm nếu bạn còn cần dữ liệu Kafka.

### 19.11 Crawler/producer: `NoBrokersAvailable`

Kafka chưa lên hoặc `KAFKA_BOOTSTRAP` sai. Từ host dùng `localhost:9092`; từ trong container dùng `kafka:29092`.
Kiểm tra: `docker ps --filter name=lake-kafka` và mở Kafka UI http://localhost:8081.

### 19.12 Giao diện Web gọi API lỗi (404, 502 hoặc `ECONNREFUSED`)

- API chưa chạy: `curl -s localhost:3001/api/health`.
- Khi chạy Web trên host, Vite chuyển tiếp `/api` tới `API_PROXY_TARGET` (mặc định `http://127.0.0.1:3001`). Kiểm tra `apps/web/.env`.
- Khi `VITE_API_BASE_URL` để trống, trình duyệt gọi cùng nguồn gốc (qua proxy của Vite). Chỉ đặt giá trị này nếu bạn muốn gọi thẳng API ở địa chỉ khác,
  và khi đó phải thêm nguồn gốc của Web vào `API_CORS_ORIGINS` (mục 21).
- Nhận 401/403 sau khi bật `API_AUTH_ENABLED=true`: xem mục 21.

### 19.13 `next build` hoặc API trên Alpine báo thiếu DuckDB delta extension / lỗi glibc

DuckDB extension cần glibc. Image API dùng `node:20-bookworm-slim`, không phải Alpine. Đừng đổi base image sang Alpine.

### 19.14 Windows: script `.sh` lỗi `\r: command not found` hoặc `bad interpreter`

File shell bị đổi sang kết thúc dòng CRLF. Clone trong WSL2 (không clone ở `C:\`), và đặt `git config core.autocrlf input` trước khi clone (mục 7.3).
Sửa file đã hỏng: `dos2unix scripts/*.sh`.

### 19.15 Docker hết dung lượng đĩa

```bash
docker system df
```

Chỉ dọn thứ không cần: `docker builder prune` xóa cache build, `docker image prune` xóa image không dùng.
**Tránh** `docker system prune --volumes` và `docker volume prune` vì chúng xóa dữ liệu MinIO, Mongo, Kafka.

## 20. Các điểm cần biết của repo

Các mục sau được kiểm tra trực tiếp trên mã nguồn của nhánh `dev-v3` khi soạn tài liệu này.

| Mục | Hiện trạng | Việc nên làm |
|---|---|---|
| `quickstart.sh` | Dòng 64 tham chiếu `docker-compose.spark.yml`, file này không tồn tại trong repo | Không dùng; làm theo README này |
| `scripts/dev-api.sh`, `scripts/dev-web.sh` | `REPO_ROOT` được tính bằng `$SCRIPT_DIR/../..`, trỏ ra ngoài repo | Dùng `pnpm --filter ... dev` (mục 13.2) |
| `make mock-stream` | Gọi `lakehouse.sources.mock.generic_generator`, module này không có (thư mục `mock/` chỉ có `retail_generator.py`) | Dùng `make produce-clickstream` hoặc `scripts/produce_kafka.sh` |
| `make scheduler` | Chú thích ghi "all 11 jobs", thực tế có 8 job | Bỏ qua con số 11 |
| `make pipeline-silver`, `make pipeline-gold` | Chỉ chạy một transformer/aggregator và chỉ truyền gói `delta-spark` | Dùng `make pipeline-batch` |
| `minio-init` | Tạo `bronze`, `silver`, `gold`, không tạo `lakehouse` | Tạo bucket theo mục 11.4 |
| `.env.example` | `AIRFLOW_FERNET_KEY` là giá trị giữ chỗ; `MONGO_URI` không có thông tin đăng nhập; `AIRFLOW_BASE_URL` dùng cổng 8080 | Sửa theo mục 9 |
| `Dockerfile.airflow` | JDK cố định cho aarch64 | Đổi sang x64 trên máy Intel/AMD (mục 7.5) |
| `docker-compose.dev-api.yml` | Service `worker` không có healthcheck | Bình thường: trạng thái hiển thị là `Up` |
| Web UI | Có `useAuthStore` và gắn header `Authorization: Bearer`, nhưng tôi không tìm thấy màn hình đăng nhập trong `apps/web/src` | Xem mục 21 |

Ngoài ra, thư mục `docs/` có nhiều tài liệu lịch sử (audit theo phase, plan, archive). Chúng phản ánh thời điểm viết, có thể không còn khớp với mã hiện tại.
Khi mâu thuẫn, ưu tiên README này và mã nguồn.

## 21. Bảo mật

### 21.1 Mặc định chỉ phù hợp cho máy cá nhân

- `API_AUTH_ENABLED` mặc định là `false`: **mọi endpoint của API không yêu cầu đăng nhập**. Chỉ chấp nhận được khi API chỉ nghe trên máy bạn.
  Không mở cổng 3001 ra mạng chung hoặc Internet ở chế độ này, vì ai truy cập được cũng có thể chạy job, ghi Kafka, kích hoạt DAG.
- Các cổng được publish ra mọi interface của máy (ví dụ `0.0.0.0:9001`). Trên mạng không tin cậy, bật tường lửa hoặc đổi cổng publish
  thành `127.0.0.1:<cổng>:<cổng>` trong file Compose.
- Mật khẩu mặc định (MinIO `minioadmin`, Airflow `admin`, MongoDB `mongoadmin`, Gold PostgreSQL) chỉ dành cho phát triển cục bộ. Đổi hết nếu máy có người khác truy cập.
  Bảng tài khoản mặc định ở mục 5.

### 21.2 Bật xác thực cho API

Các biến trong `apps/api/.env.local` (định nghĩa ở `apps/api/src/config/env.ts`):

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `API_AUTH_ENABLED` | Bật xác thực và phân quyền | `false` |
| `API_JWT_SECRET` | Khóa HMAC cho token phiên và token xác nhận, tối thiểu 32 ký tự | giá trị phát triển cố định, **phải đổi** |
| `API_SESSION_TTL_SECONDS` | Thời gian sống của phiên (tối thiểu 60) | `3600` |
| `API_CONFIRM_TOKEN_TTL_SECONDS` | Thời gian sống của token xác nhận thao tác nguy hiểm (tối thiểu 10) | `120` |
| `API_SERVICE_KEYS` | Mảng JSON khóa dịch vụ (`keyId`, `secretHash` SHA-256 dạng hex, `principalId`, `role`, `scopes`) | rỗng |
| `API_USER_CREDENTIALS` | Mảng JSON tài khoản người dùng (`principalId`, `secretHash`, `role`, `scopes`) | rỗng |
| `API_AUDIT_ENABLED` | Ghi nhật ký kiểm toán | `true` |
| `API_RATE_LIMIT_PER_MIN` | Giới hạn yêu cầu mỗi phút | `600` |
| `API_RATE_LIMIT_FAIL_OPEN` | Khi Redis hỏng: `true` cho qua, `false` trả 503 | `true` |
| `API_CORS_ORIGINS` | Danh sách nguồn gốc được phép, phân tách bằng dấu phẩy | `http://localhost:3000` |
| `API_SWAGGER_ENABLED` | Bật Swagger UI | `true` |

Sinh khóa bí mật mạnh:

```bash
openssl rand -hex 32
```

Có bốn vai trò: `viewer` (chỉ đọc), `analyst` (thêm EDA, DQ, xem mẫu dữ liệu), `operator` (thêm chạy pipeline, nạp dữ liệu, ghi Kafka, đồng bộ catalog), `admin` (toàn quyền, gồm thao tác phá hủy).
Quyền gắn theo từng route trong `apps/api/src/modules/security/services/policy.service.ts`.

Route công khai (không cần credential): `/api/health`, `/api/health/deep`, `/api/info`, `/api/docs`, `/api/doc`, `/api/api-doc` và `/api/auth/login`.

Tạo quản trị viên đầu tiên (đã có script, đọc thông tin từ biến môi trường để mật khẩu không nằm trong lệnh hay repo; cần MongoDB đang chạy và `apps/api/.env.local` đúng):

```bash
cd apps/api
API_BOOTSTRAP_ADMIN_EMAIL='admin@example.com' \
API_BOOTSTRAP_ADMIN_PASSWORD='<mat-khau-manh>' \
pnpm run security:bootstrap
```

Script idempotent: nếu tài khoản đã tồn tại thì không tạo trùng. Đăng nhập qua `POST /api/auth/login` với JSON `{"email": "...", "password": "..."}`.
Cấu trúc phản hồi xem ở Swagger. Thao tác nguy hiểm cần thêm token từ `POST /api/auth/confirm` (body `{"action": "...", "resource": "..."}`)
và gửi trong header `x-confirm-token`.

Lưu ý về Web UI: ứng dụng Web có kho lưu token (`lakehouse.token` trong `localStorage`) và tự gắn `Authorization: Bearer`, nhưng tôi **không tìm thấy** màn hình đăng nhập.
Vì vậy khi bật `API_AUTH_ENABLED=true`, Web UI có thể nhận 401 cho tới khi có cách nạp token. Tôi chưa kiểm thử luồng này đầu-cuối.
Nếu cần dùng Web UI với xác thực bật, hãy xác nhận hoặc bổ sung màn hình đăng nhập trước.

### 21.3 Quản lý bí mật

- `.env`, `apps/api/.env.local`, `apps/web/.env` chứa bí mật; không commit. Kiểm tra trước khi commit: `git status` và `git diff --cached`.
- Không dán token Databricks, khóa R2, `METABASE_API_KEY`, `API_JWT_SECRET` vào chat, issue hay log.
- Nếu một bí mật đã bị lộ (commit nhầm, gửi nhầm), thu hồi và tạo mới ngay; xóa khỏi lịch sử Git không đủ.
- Thông tin `secretHash` trong `API_SERVICE_KEYS` là SHA-256 của bí mật, không phải bí mật thô. Giữ bí mật thô ở nơi an toàn.
- Không công khai Metabase (cổng 3000) trực tiếp. Dùng Cloudflare Tunnel kèm Access như `docs/METABASE_SHARING.md`.

### 21.4 Giới hạn của tài liệu này

Tôi đã đọc cấu hình và mã xác thực, nhưng không chạy kiểm thử thâm nhập hay rà soát bảo mật toàn diện.
Trước khi đưa hệ thống ra ngoài máy cá nhân, cần một lượt rà soát bảo mật riêng.

## 22. Tài liệu tham khảo

Các file dưới đây đều có trong repo (đã kiểm tra tồn tại).

| Chủ đề | File |
|---|---|
| Khởi động nhanh | `docs/operations/quickstart.md` |
| Biến môi trường | `docs/operations/environment.md` |
| Docker | `docs/operations/docker.md` |
| Kiểm thử | `docs/operations/testing.md` |
| CI/CD | `docs/operations/ci-cd.md` |
| Runbook E2E | `docs/operations/E2E_RUNBOOK.md` |
| Liên kết dev | `docs/operations/DEV_LINKS.md` |
| Databricks | `docs/operations/DATABRICKS_SETUP.md` |
| Cloudflare R2 | `docs/cloud/r2/SETUP.md`, `docs/cloud/r2/SPARK_CONFIG.md`, `docs/operations/R2_SETUP.md` |
| Kiến trúc | `docs/architecture/ARCHITECTURE.md`, `docs/architecture/medallion.md`, `docs/architecture/STREAMING_SEMANTICS.md` |
| Bố cục dữ liệu | `docs/handbook/DATA_LAYOUT.md` |
| ETL và ELT | `docs/handbook/ETL_VS_ELT.md` |
| Hướng dẫn giao diện | `docs/handbook/UI_GUIDE.md` |
| API | `docs/handbook/API.md`, `docs/api/endpoints.md`, `apps/api/README.md` |
| Chia sẻ Metabase | `docs/METABASE_SHARING.md` |
| Kế hoạch Control Plane, EDA, DQ | `docs/DATA_LAKEHOUSE_INTERACTIVE_CONTROL_PLANE_EDA_DQ_MASTER_PLAN_2026-10-24.md` |
| Tình trạng dự án | `docs/PROJECT_STATUS_AND_REMAINING_WORK.md` |
