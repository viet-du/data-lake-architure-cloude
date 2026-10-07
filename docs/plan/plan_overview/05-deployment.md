

Project này có thể deploy lên cloud với **chi phí $0/tháng** dùng free tier:

| Cloud | Free tier | Đủ cho project? |
|-------|-----------|-----------------|
| **GCP** | $300 credit 90 ngày, sau đó Always Free |  |
| **AWS** | 12 tháng Free Tier, sau đó một số free |  |
| **Azure** | $200 credit 30 ngày + 12 tháng free |  |
| **Oracle** | 4 ARM VM 24GB RAM **vĩnh viễn** |  (tốt nhất) |



| Service | Free tier | Thay thế cho |
|---------|-----------|--------------|
| Cloud Storage (GCS) | 5GB | MinIO |
| Dataproc | Preemptible $0.01/hr | Spark |
| Pub/Sub | 10GB msg/tháng | Kafka |
| BigQuery | 1TB query/tháng | (bonus) |
| Composer | Không free | Airflow (tự host) |


```bash
brew install --cask google-cloud-sdk
gcloud init
gcloud config set project YOUR_PROJECT_ID

gsutil mb -l asia-southeast1 gs://data-lake-architecture-bronze
gsutil mb -l asia-southeast1 gs://data-lake-architecture-silver
gsutil mb -l asia-southeast1 gs://data-lake-architecture-gold
```


Chỉ cần đổi path:

```python
BRONZE_PATH = "s3a://bronze/"

BRONZE_PATH = "gs://data-lake-architecture-bronze/"
```

Hoặc dùng env variable:

```python
import os
ENV = os.getenv("ENV", "local")
if ENV == "local":
    BRONZE_PATH = "s3a://bronze/"
elif ENV == "gcp":
    BRONZE_PATH = "gs://data-lake-architecture-bronze/"
```


```bash
gcloud dataproc clusters create data-lake-cluster \
  --region asia-southeast1 \
  --zone asia-southeast1-a \
  --master-machine-type n1-standard-2 \
  --worker-machine-type n1-standard-2 \
  --num-workers 2 \
  --preemptible-workers 2 \
  --image-version 2.1-debian11 \
  --initialization-actions gs://goog-dataproc-initialization-actions-asia-southeast1/connectors/connectors.sh \
  --optional-components JUPYTER \
  --properties "spark:spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension,spark:spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog"

gcloud dataproc jobs submit pyspark \
  --cluster data-lake-cluster \
  --region asia-southeast1 \
  --properties "spark.jars.packages=io.delta:delta-spark_2.12:3.0.0" \
  gs://data-lake-architecture-scripts/02_transform_to_silver.py

gcloud dataproc clusters delete data-lake-cluster --region asia-southeast1
```


```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path("YOUR_PROJECT", "clickstream-events")

future = publisher.publish(topic_path, json.dumps(event).encode())
```

**Free**: 10GB/tháng (~1 triệu messages nhỏ)


```
GCS storage (5GB)    : $0
Dataproc preemptible : $0.01/hr × 10h = $0.10
Pub/Sub (10GB)       : $0
BigQuery (1TB)       : $0
─────────────────────────────────
TỔNG                : $0.10/tháng
```



| Service | Free tier | Thay thế |
|---------|-----------|----------|
| S3 | 5GB (12 tháng) | MinIO |
| EMR | Không free ($$) | Spark |
| MSK | Không free | Kafka |
| Kinesis | 1M msg/tháng free | Kafka (limited) |
| Glue | 1M request/tháng | ETL |
| Athena | 1GB scan/tháng | Query |


```bash
aws s3 mb s3://data-lake-architecture-bronze --region ap-southeast-1
aws s3 mb s3://data-lake-architecture-silver --region ap-southeast-1
aws s3 mb s3://data-lake-architecture-gold --region ap-southeast-1
```



-  4 ARM VM (24GB RAM total) - **VĨNH VIỄN**
-  200GB Block Storage
-  10GB Object Storage
-  2 Database (Autonomous)


```bash
https://www.oracle.com/cloud/free/


ssh ubuntu@<VM_IP>

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

git clone <your_repo>
cd data-lake-architecture
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
```

**Cost: $0 vĩnh viễn** (tốt nhất cho đồ án!)



- [ ] Tạo cloud account
- [ ] Setup billing alerts (không bị charge ngoài ý muốn)
- [ ] Tạo buckets/storage
- [ ] Migrate scripts (s3a:// → gs:// hoặc s3://)
- [ ] Test chạy 1 job
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Monitor costs


```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Deploy
        run: |
          gsutil -m cp -r scripts/ gs://data-lake-architecture-scripts/
          gcloud dataproc jobs submit pyspark \
            --cluster data-lake-cluster \
            --region asia-southeast1 \
            gs://data-lake-architecture-scripts/04_elt_pipeline.py
```


-  **Use Spot/Preemptible** instances (rẻ 80%)
-  **Delete resources** khi không dùng
-  **Setup budget alerts**
-  **Use Cloud Storage classes**: Standard → Nearline → Coldline → Archive
-  **Compress data**: gzip, snappy, zstd
-  **Partition aggressively**: Query nhanh hơn, chi phí thấp hơn


Với **$0-5/tháng** bạn có thể:
-  Chạy production data lake trên cloud
-  Lambda Architecture (batch + stream)
-  Không lo chi phí (dùng free tier)
-  Scale dễ dàng khi cần
