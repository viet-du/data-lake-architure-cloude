# 12 – Hướng dẫn Setup Data Lake trên GCP Cloud (Step-by-Step)

> 🎯 Mục tiêu: Triển khai **toàn bộ Data Lake** lên **Google Cloud Platform** với chi phí **$0-5/tháng** (dùng free tier).

---

## 📋 Mục lục

1. [Tổng quan các bước](#1-tổng-quan-các-bước)
2. [Bước 1: Tạo GCP Account](#2-bước-1-tạo-gcp-account)
3. [Bước 2: Cài đặt Tools](#3-bước-2-cài-đặt-tools)
4. [Bước 3: Setup GCS (thay MinIO)](#4-bước-3-setup-gcs)
5. [Bước 4: Setup Dataproc (thay Spark local)](#5-bước-4-setup-dataproc)
6. [Bước 5: Setup Pub/Sub (thay Kafka)](#6-bước-5-setup-pubsub)
7. [Bước 6: Migrate Scripts](#7-bước-6-migrate-scripts)
8. [Bước 7: Chạy Pipeline trên Cloud](#8-bước-7-chạy-pipeline)
9. [Bước 8: Setup BigQuery (Bonus)](#9-bước-8-setup-bigquery)
10. [Bước 9: Setup CI/CD với GitHub](#10-bước-9-cicd)
11. [Cost Optimization](#11-cost-optimization)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Tổng quan các bước

```
┌──────────────────────────────────────────────────────────────────┐
│                GCP Data Lake Architecture                       │
│                                                                  │
│  LOCAL (đã có)          →   CLOUD (mới setup)                  │
│  ─────────────             ──────────▶                          │
│  MinIO               →   Cloud Storage (GCS)                   │
│  Spark local         →   Dataproc (managed Spark)             │
│  Kafka              →   Pub/Sub                                │
│  Airflow local      →   Cloud Composer (optional, $$)          │
│  Metabase local     →   Looker Studio (free)                   │
│                                                                  │
│  TOTAL COST: ~$0.5-5/tháng                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Thời gian setup**: 30-60 phút.

---

## 2. Bước 1: Tạo GCP Account

### 2.1. Đăng ký

1. Truy cập: https://cloud.google.com/free
2. Bấm **"Get started for free"**
3. Đăng nhập bằng Google account
4. Chọn **Country**: Vietnam
5. Đồng ý Terms of Service
7. Nhập thông tin thẻ tín dụng (chỉ để verify, **KHÔNG bị charge** trong free tier)

### 2.2. Nhận $300 Free Credit
- Có ngay **$300 credit** dùng trong 90 ngày
- Sau 90 ngày, account vẫn active và dùng **Always Free** products

### 2.3. Always Free Products (vĩnh viễn)
| Service | Free tier mỗi tháng |
|---------|---------------------|
| **Cloud Storage** | 5GB Standard + 100GB Nearline |
| **Dataproc** | Không có free tier ($$) |
| **Pub/Sub** | 10GB messages |
| **BigQuery** | 1TB query + 10GB storage |
| **Compute Engine** | 1 f1-micro instance |
| **Cloud Functions** | 2M invocations |

> ⚠️ **Lưu ý**: Dataproc **không có free tier**, nhưng có thể dùng **$300 credit** (đủ ~600 giờ chạy).

---

## 3. Bước 2: Cài đặt Tools

### 3.1. Cài `gcloud` CLI (macOS)

```bash
# Cách 1: Dùng Homebrew (khuyến nghị)
brew install --cask google-cloud-sdk

# Cách 2: Download từ Google
# https://cloud.google.com/sdk/docs/install
```

### 3.2. Khởi tạo gcloud

```bash
# Login
gcloud init

# Lúc này sẽ hỏi:
# 1. Chọn account → chọn account bạn vừa tạo
# 2. Chọn project → tạo project mới hoặc chọn existing
# 3. Chọn zone → asia-southeast1-a (Singapore, gần VN nhất)

# Verify
gcloud config list
```

Output mong đợi:
```
[core]
account = your-email@gmail.com
disable_usage_reporting = False
project = your-project-id
region = asia-southeast1
zone = asia-southeast1-a
```

### 3.3. Set environment variables (tiện dụng)

```bash
# Thêm vào ~/.zshrc hoặc ~/.bash_profile
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-southeast1"
export GCP_ZONE="asia-southeast1-a"
export GCS_BUCKET_PREFIX="data-lake-architecture"

# Reload
source ~/.zshrc
```

---

## 4. Bước 3: Setup GCS (Google Cloud Storage - thay MinIO)

### 4.1. Tạo buckets

```bash
# Set project (thay your-project-id bằng ID thật)
gcloud config set project YOUR_PROJECT_ID

# Tạo 3 buckets (Bronze, Silver, Gold)
gsutil mb -l $GCP_REGION gs://${GCS_BUCKET_PREFIX}-bronze
gsutil mb -l $GCP_REGION gs://${GCS_BUCKET_PREFIX}-silver
gsutil mb -l $GCP_REGION gs://${GCS_BUCKET_PREFIX}-gold

# Tạo bucket cho scripts
gsutil mb -l $GCP_REGION gs://${GCS_BUCKET_PREFIX}-scripts

# Verify
gsutil ls
```

Output:
```
gs://data-lake-architecture-bronze/
gs://data-lake-architecture-gold/
gs://data-lake-architecture-scripts/
gs://data-lake-architecture-silver/
```

### 4.2. Cấu hình bucket

```bash
# Set lifecycle policy (tự động chuyển data cũ sang Nearline - rẻ hơn)
cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

# Apply cho từng bucket
for bucket in bronze silver gold; do
  gsutil lifecycle set /tmp/lifecycle.json gs://${GCS_BUCKET_PREFIX}-${bucket}/
done
```

### 4.3. Set CORS (cho phép web access)

```bash
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set /tmp/cors.json gs://${GCS_BUCKET_PREFIX}-gold/
```

### 4.4. Tạo folder structure

```bash
# Bronze layer
for layer in bronze silver gold; do
  for data_type in tiki crm erp clickstream ecommerce; do
    gsutil -m cp -r /dev/null gs://${GCS_BUCKET_PREFIX}-${layer}/${data_type}/ 2>/dev/null || true
  done
done
```

### 4.5. Truy cập GCS thông qua UI

1. Vào https://console.cloud.google.com/storage
2. Chọn project
3. Thấy 4 buckets vừa tạo
5. Click vào bucket để xem files

---

## 5. Bước 4: Setup Dataproc (Managed Spark)

###  6.1. Enable API

```bash
gcloud services enable dataproc.googleapis.com
gcloud services enable compute.googleapis.com
```

### 5.2. Tạo Service Account

```bash
# Tạo service account cho Dataproc
gcloud iam service-accounts create datalake-sa \
  --display-name="Data Lake Service Account" \
  --description="Service account for Dataproc jobs"

# Grant roles cần thiết
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:datalake-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:datalake-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dataproc.editor"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:datalake-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.user"

# Download key
gcloud iam service-accounts keys create ~/datalake-sa-key.json \
  --iam-account=datalake-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com

# Set GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS=~/datalake-sa-key.json
echo 'export GOOGLE_APPLICATION_CREDENTIALS=~/datalake-sa-key.json' >> ~/.zshrc
```

### 5.3. Tạo Dataproc Cluster

```bash
# Tạo cluster với Delta Lake
gcloud dataproc clusters create datalake-cluster \
  --region=$GCP_REGION \
  --zone=$GCP_ZONE \
  --master-machine-type=n1-standard-2 \
  --worker-machine-type=n1-standard-2 \
  --num-workers=2 \
  --image-version=2.1-debian11 \
  --optional-components=JUPYTER \
  --bucket=${GCS_BUCKET_PREFIX}-scripts \
  --initialization-actions=gs://goog-dataproc-initialization-actions-${GCP_REGION}/connectors/connectors.sh \
  --properties="spark:spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension,spark:spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog,spark:spark.databricks.delta.schema.autoMerge.enabled=true" \
  --max-idle=30m \
  --single-node=false
```

⏰ Cluster tạo mất ~3-5 phút.

```bash
# Verify cluster
gcloud dataproc clusters list --region=$GCP_REGION
```

### 5.4. Truy cập Jupyter (optional)

1. Vào https://console.cloud.google.com/dataproc
2. Click cluster `datalake-cluster`
3. Tab **"Web Interfaces"** → Click **"Jupyter"**
4. JupyterLab sẽ mở trong tab mới

---

## 6. Bước 5: Setup Pub/Sub (thay Kafka)

### 6.1. Tạo topics

```bash
gcloud pubsub topics create tiki-category-stream
gcloud pubsub topics create clickstream-events
gcloud pubsub topics create ecommerce-products-stream

# Verify
gcloud pubsub topics list
```

### 6.2. Tạo subscriptions

```bash
gcloud pubsub subscriptions create tiki-stream-sub --topic=tiki-category-stream
gcloud pubsub subscriptions create clickstream-sub --topic=clickstream-events
gcloud pubsub subscriptions create ecommerce-sub --topic=ecommerce-products-stream
```

### 6.3. Test publish (optional)

```bash
# Publish 1 message test
gcloud pubsub topics publish tiki-category-stream \
  --message='{"test": "hello", "category": "smartphone"}'

# Xem message trong subscription
gcloud pubsub subscriptions pull tiki-stream-sub --auto-ack --limit=1
```

---

## 7. Bước 6: Migrate Scripts

### 7.1. Upload scripts lên GCS

```bash
# Upload toàn bộ folder scripts/
gsutil -m cp -r scripts/ gs://${GCS_BUCKET_PREFIX}-scripts/

# Verify
gsutil ls gs://${GCS_BUCKET_PREFIX}-scripts/scripts/
```

### 7.2. Sửa file 12 (crawler) dùng Pub/Sub thay Kafka

```python
# scripts/12_multithread_category_crawler_gcp.py
"""Multi-thread Crawler - version cho GCP (dùng Pub/Sub thay Kafka)."""
import os
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from google.cloud import pubsub_v1
from google.cloud.pubsub_v1.publisher import futures

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-project-id")
TOPIC_NAME = "tiki-category-stream"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_NAME)


def send_to_pubsub(event: dict):
    """Gửi event vào Pub/Sub."""
    key = f"{event.get('category_key')}:{event.get('id')}"
    data = json.dumps(event, ensure_ascii=False).encode("utf-8")
    future = publisher.publish(topic_path, data, key=key.encode())
    return future.result()


def crawl_category(category_key, max_pages=3):
    """Crawl 1 category."""
    # ... giống code cũ ...
    for product in products:
        event = enrich_product(product)
        send_to_pubsub(event)  # ← Thay vì Kafka


def main():
    with ThreadPoolExecutor(max_workers=8) as executor:
        # Submit workers...
```

### 7.3. Sửa file 13 (Spark Streaming) dùng Pub/Sub

```python
# Sửa trong script 13_category_revenue_streaming.py:
# Thay vì Kafka, dùng Pub/Sub

# Đọc từ Pub/Sub thay Kafka:
from pyspark.sql.functions import from_json

# Cách 1: Dùng Spark Pub/Sub connector
df = (
    spark.readStream
    .format("pubsub")  # ← Thay vì "kafka"
    .option("subscriptionPath", f"projects/{PROJECT_ID}/subscriptions/tiki-stream-sub")
    .load()
)
```

> 📦 **Lưu ý**: Để dùng Pub/Sub connector, cần JAR riêng:
```bash
gcloud dataproc jobs submit pyspark \
  --jars=gs://spark-lib/pubsub/pubsub-spark-sql-streaming-LATEST.jar \
  --properties="spark.jars.packages=com.google.cloud:pubsub-spark-sql-streaming:1.0.0" \
  ...
```

### 7.4. Tạo file config cho từng môi trường

```python
# config.py
import os

ENV = os.getenv("ENV", "local")

# Paths
if ENV == "local":
    BRONZE_PATH = "s3a://bronze/"
    SILVER_PATH = "s3a://silver/"
    GOLD_PATH = "s3a://gold/"
    KAFKA_BOOTSTRAP = "localhost:9092"
elif ENV == "gcp":
    PROJECT_ID = os.getenv("GCP_PROJECT_ID")
    BRONZE_PATH = f"gs://data-lake-architecture-bronze/"
    SILVER_PATH = f"gs://data-lake-architecture-silver/"
    GOLD_PATH = f"gs://data-lake-architecture-gold/"
    PUBSUB_SUBSCRIPTION = f"projects/{PROJECT_ID}/subscriptions/tiki-stream-sub"
```

---

## 8. Bước 7: Chạy Pipeline trên Cloud

### 8.1. Upload scripts (nếu chưa)

```bash
gsutil -m cp -r scripts/ gs://${GCS_BUCKET_PREFIX}-scripts/
```

### 8.2. Chạy Bronze ingest

```bash
# Submit Spark job lên Dataproc
gcloud dataproc jobs submit pyspark \
  --cluster=datalake-cluster \
  --region=$GCP_REGION \
  --jars=gs://spark-lib/delta/delta-core_2.12-3.0.0.jar \
  --properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
  --py-files=gs://${GCS_BUCKET_PREFIX}-scripts/scripts/utils.zip \
  gs://${GCS_BUCKET_PREFIX}-scripts/scripts/01_ingest_to_bronze.py
```

### 8.3. Chạy Silver transform

```bash
gcloud dataproc jobs submit pyspark \
  --cluster=datalake-cluster \
  --region=$GCP_REGION \
  --properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
  gs://${GCS_BUCKET_PREFIX}-scripts/scripts/02_transform_to_silver.py
```

### 8.4. Chạy Gold aggregate

```bash
gcloud dataproc jobs submit pyspark \
  --cluster=datalake-cluster \
  --region=$GCP_REGION \
  --properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
  gs://${GCS_BUCKET_PREFIX}-scripts/scripts/03_aggregate_to_gold.py
```

### 8.5. Chạy Spark Streaming (real-time)

```bash
# Persistent streaming job (chạy liên tục)
gcloud dataproc jobs submit pyspark \
  --cluster=datalake-cluster \
  --region=$GCP_REGION \
  --properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0,com.google.cloud:pubsub-spark-sql-streaming:1.0.0" \
  --max-failures-per-hour=10 \
  gs://${GCS_BUCKET_PREFIX}-scripts/scripts/13_category_revenue_streaming.py
```

### 8.6. Check job status

```bash
# List jobs
gcloud dataproc jobs list --region=$GCP_REGION --state-filter=ACTIVE

# Get specific job
gcloud dataproc jobs describe JOB_ID --region=$GCP_REGION

# View logs
gcloud dataproc jobs wait JOB_ID --region=$GCP_REGION
```

### 8.7. Query data từ GCS

```bash
# Dùng Cloud SQL Workspace (web-based Spark)
# https://console.cloud.google.com/dataproc

# Hoặc SSH vào master node
gcloud compute ssh datalake-cluster-m --zone=$GCP_ZONE

# Sau đó trên master node:
spark-sql --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "SELECT * FROM delta.\`gs://data-lake-architecture-gold/fact_orders/\` LIMIT 10"
```

---

## 9. Bước 8: Setup BigQuery (Bonus - cho BI Dashboard)

### 9.1. Tạo dataset

```bash
bq mk --location=$GCP_REGION datalake
```

### 9.2. Export Gold layer → BigQuery

```bash
# Tạo external table từ GCS Parquet
bq mk \
    --external_table_definition=@def.json \
    datalake.fact_orders

# File def.json:
cat > /tmp/def.json << EOF
{
  "sourceFormat": "PARQUET",
  "sourceUris": ["gs://data-lake-architecture-gold/fact_orders/*.parquet"],
  "autodetect": true,
  "hivePartitioningOptions": {
    "mode": "AUTO",
    "sourcePartitionPrefix": "order_date=",
    "partitionExpiryDays": 2
  }
}
EOF
```

### 9.3. Query BigQuery

```sql
-- Trong BigQuery console:
SELECT
  category_name,
  SUM(total_revenue_estimate) AS revenue,
  SUM(total_units_sold) AS units_sold
FROM `your-project-id.datalake.fact_orders`
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY category_name
ORDER BY revenue DESC
LIMIT 10;
```

### 9.4. Setup Looker Studio (Free BI)

1. Vào https://lookerstudio.google.com
2. **Create** → **Report**
3. **Add data** → **BigQuery**
4. Chọn `datalake.fact_orders`
5. Kéo thả charts:
   - **Bar chart**: Revenue by category
   - **Time series**: Revenue over time
   - **Pie chart**: Market share by parent category
   - **Table**: Top 10 products
6. **Share** → public link

---

## 10. Bước 9: Setup CI/CD với GitHub

### 10.1. Tạo GitHub Actions workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Auth to GCP
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Upload scripts to GCS
        run: |
          gsutil -m cp -r scripts/ gs://${{ secrets.GCS_BUCKET }}-scripts/

      - name: Submit Spark job
        run: |
          gcloud dataproc jobs submit pyspark \
            --cluster=datalake-cluster \
            --region=asia-southeast1 \
            --properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
            gs://${{ secrets.GCS_BUCKET }}-scripts/scripts/02_transform_to_silver.py
```

### 10.2. Setup GitHub Secrets

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**:
   - `GCP_SA_KEY`: Paste nội dung file `~/datalake-sa-key.json`
   - `GCP_PROJECT_ID`: your-project-id
   - `GCS_BUCKET`: data-lake-architecture

### 10.3. Test CI/CD

```bash
git add .
git commit -m "Deploy to GCP"
git push origin main
# → GitHub Actions tự động deploy
```

---

## 11. Cost Optimization

### 11.1. Tắt Dataproc khi không dùng

```bash
# Tạo script: ~/start-cluster.sh
#!/bin/bash
gcloud dataproc clusters create datalake-cluster \
  --region=$GCP_REGION \
  --master-machine-type=n1-standard-2 \
  --worker-machine-type=n1-standard-2 \
  --num-workers=2 \
  --max-idle=10m \
  --image-version=2.1-debian11

# Tạo script: ~/stop-cluster.sh
#!/bin/bash
gcloud dataproc clusters delete datalake-cluster --region=$GCP_REGION
```

### 11.2. Dùng Preemptible instances (rẻ 80%)

```bash
gcloud dataproc clusters create datalake-cluster \
  --region=$GCP_REGION \
  --master-machine-type=n1-standard-2 \
  --worker-machine-type=n1-standard-2 \
  --num-workers=2 \
  --preemptible-workers=2 \
  ...
```

### 11.3. Setup Budget Alert

```bash
# Alert khi tổng cost > $5
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Data Lake Budget" \
  --budget-amount=5 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100

# Verify
gcloud billing budgets list
```

### 11.4. Dùng GCS Storage Classes

| Class | Use case | Cost/GB/tháng |
|-------|----------|---------------|
| **Standard** | Hot data (< 30 ngày) | $0.020 |
| **Nearline** | Warm (30-90 ngày) | $0.010 |
| **Coldline** | Cold (90-365 ngày) | $0.004 |
| **Archive** | Frozen (> 365 ngày) | $0.0012 |

Đã set lifecycle ở **Bước 4.2** ✅

### 11.5. Cost Estimate cho Data Lake nhỏ

```
GCS Standard 5GB         : $0.10/tháng
GCS Nearline 10GB        : $0.10/tháng
Pub/Sub 10GB             : $0
Dataproc (10h preempt)   : $0.50/tháng
BigQuery (1GB query)     : $0
─────────────────────────────────
TỔNG                     : ~$0.70/tháng
```

Với **$300 credit** (90 ngày): chạy được **~50 năm**!

---

## 12. Troubleshooting

### 12.1. `gcloud` command not found

```bash
# Reinstall
brew reinstall --cask google-cloud-sdk

# Hoặc thêm vào PATH
export PATH=$PATH:/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin
```

### 12.2. Permission denied khi tạo cluster

```bash
# Enable APIs
gcloud services enable dataproc.googleapis.com
gcloud services enable compute.googleapis.com

# Check IAM
gcloud projects get-iam-policy $GCP_PROJECT_ID
```

### 12.3. Dataproc cluster tạo lâu

```
⏰ Chờ 3-5 phút, bình thường
```

### 12.4. Spark job fail: "delta package not found"

```bash
# Thêm --properties
--properties="spark.jars.packages=io.delta:delta-spark_2.12:3.0.0"
```

### 12.5. GCS access denied từ Dataproc

```bash
# Kiểm tra service account có quyền:
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:datalake-sa@*"

# Nếu chưa có role storage.admin:
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:datalake-sa@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### 12.6. BigQuery không thấy data

```bash
# Kiểm tra parquet files đã được tạo
gsutil ls gs://data-lake-architecture-gold/fact_orders/

# Nếu rỗng, chạy lại Gold job
gcloud dataproc jobs submit pyspark \
  --cluster=datalake-cluster \
  --region=$GCP_REGION \
  gs://data-lake-architecture-scripts/scripts/03_aggregate_to_gold.py
```

### 12.7. Cost cao bất thường

```bash
# Check cost breakdown
gcloud billing accounts list
gcloud billing accounts get-iam-policy YOUR_BILLING_ACCOUNT_ID

# Xem cost report
# Vào https://console.cloud.google.com/billing
```

---

## 13. Checklist cuối cùng

- [ ] GCP account active
- [ ] gcloud CLI installed
- [ ] 3 GCS buckets created (bronze, silver, gold)
- [ ] Service account created
- [ ] Dataproc cluster created
- [ ] Pub/Sub topics created
- [ ] Scripts uploaded to GCS
- [ ] Spark jobs submitted thành công
- [ ] Data có trong Gold layer
- [ ] Budget alerts setup
- [ ] (Optional) BigQuery + Looker Studio

## 14. Tóm tắt

Bạn đã setup thành công **production-ready** Data Lake trên GCP với:

| Service | Cost |
|---------|------|
| **Cloud Storage** (5GB free) | $0 |
| **Dataproc** (preemptible) | ~$0.50/tháng |
| **Pub/Sub** (10GB free) | $0 |
| **BigQuery** (1TB query free) | $0 |
| **Tổng** | **~$0.5-5/tháng** |

Giờ bạn có thể:
- ✅ Chạy batch ETL real-time trên cloud
- ✅ Scale tự động (Dataproc tự động thêm worker)
- ✅ BI dashboard với Looker Studio (free)
- ✅ CI/CD với GitHub Actions
- ✅ Audit log đầy đủ
- ✅ Không lo downtime

> 🚀 **Next**: Học cách deploy với Terraform (Infrastructure as Code) để tự động hóa 100%.