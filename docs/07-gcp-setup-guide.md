# 07 – GCP Setup Guide (Free Tier)

## 1. Tạo GCP Account

1. Vào https://cloud.google.com/free
2. Bấm "Get started for free"
3. Đăng nhập Google account
4. Cung cấp thông tin (cần credit card nhưng **không charge** trong free tier)

**Free tier**:
- $300 credit trong 90 ngày
- Always Free products (sau 90 ngày):
  - 5GB Cloud Storage
  - 1 BigQuery query/ngày
  - 10GB Pub/Sub
  - 1 f1-micro Compute Engine

## 2. Cài gcloud CLI

### macOS
```bash
brew install --cask google-cloud-sdk
```

### Linux
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Windows
Tải installer: https://cloud.google.com/sdk/docs/install

## 3. Init gcloud

```bash
gcloud init
# Chọn project, login browser, etc.

gcloud config set project YOUR_PROJECT_ID
gcloud config set compute/region asia-southeast1
gcloud config set compute/zone asia-southeast1-a
```

## 4. Enable APIs

```bash
gcloud services enable \
  compute.googleapis.com \
  storage.googleapis.com \
  dataproc.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  composer.googleapis.com
```

## 5. Tạo GCS Buckets

```bash
gsutil mb -l asia-southeast1 gs://YOUR_PROJECT-bronze
gsutil mb -l asia-southeast1 gs://YOUR_PROJECT-silver
gsutil mb -l asia-southeast1 gs://YOUR_PROJECT-gold

# Verify
gsutil ls
```

## 6. Tạo Service Account (cho Dataproc)

```bash
gcloud iam service-accounts create datalake-sa \
  --display-name="Data Lake Service Account"

# Grant roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:datalake-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:datalake-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dataproc.editor"

# Download key
gcloud iam service-accounts keys create ~/datalake-sa-key.json \
  --iam-account=datalake-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 7. Tạo Dataproc Cluster

```bash
gcloud dataproc clusters create data-lake-cluster \
  --region asia-southeast1 \
  --zone asia-southeast1-a \
  --master-machine-type n1-standard-2 \
  --worker-machine-type n1-standard-2 \
  --num-workers 2 \
  --image-version 2.1-debian11 \
  --optional-components JUPYTER \
  --initialization-actions gs://goog-dataproc-initialization-actions-asia-southeast1/connectors/connectors.sh \
  --properties "spark:spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension,spark:spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog"
```

## 8. Submit Spark Job

```bash
# Upload scripts lên GCS
gsutil cp -r scripts/ gs://YOUR_PROJECT-scripts/

# Submit job
gcloud dataproc jobs submit pyspark \
  --cluster data-lake-cluster \
  --region asia-southeast1 \
  --jars gs://spark-lib/delta/delta-core_2.12-3.0.0.jar \
  --properties "spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
  gs://YOUR_PROJECT-scripts/02_transform_to_silver.py
```

## 9. Setup Pub/Sub

```bash
# Tạo topic
gcloud pubsub topics create clickstream-events

# Tạo subscription
gcloud pubsub subscriptions create clickstream-sub \
  --topic=clickstream-events

# Publish test message
gcloud pubsub topics publish clickstream-events \
  --message='{"event_id":"test1","user_id":"U001"}'
```

## 10. Setup BigQuery (bonus)

```bash
# Tạo dataset
bq mk --location=asia-southeast1 datalake

# Tạo table từ Gold layer
bq load \
  --source_format=PARQUET \
  --autodetect \
  datalake.fact_orders \
  gs://YOUR_PROJECT-gold/fact_orders/*.parquet
```

## 11. Cost Optimization

- ✅ Dùng **preemptible/spot instances** (rẻ 80%)
- ✅ Xóa cluster khi không dùng
- ✅ Lifecycle policy cho GCS (Standard → Nearline → Coldline)
- ✅ Alert khi cost > $5
- ✅ Compression data

```bash
# Setup budget alert
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="Data Lake Budget" \
  --budget-amount=5 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## 12. Cleanup (tránh charge ngoài ý muốn)

```bash
# Xóa cluster
gcloud dataproc clusters delete data-lake-cluster --region asia-southeast1

# Xóa buckets (nếu muốn)
gsutil -m rm -r gs://YOUR_PROJECT-bronze
gsutil -m rm -r gs://YOUR_PROJECT-silver
gsutil -m rm -r gs://YOUR_PROJECT-gold
```

## 13. Cost Estimate

```
GCS storage 5GB         : $0.10/tháng
Dataproc (10h preempt)  : $0.50/tháng
Pub/Sub 10GB            : $0
BigQuery 1TB query      : $0
─────────────────────────────────
TỔNG                    : ~$0.60/tháng
```

Với $300 credit, bạn chạy **~50 năm**!

## 14. Kết luận

GCP Free tier rất rộng rãi cho project đồ án. Tận dụng:
- Dataproc cho Spark
- GCS cho storage
- Pub/Sub cho streaming
- BigQuery cho analytics
