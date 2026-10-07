

Project `data-lake-architecture` đã bị mất **toàn bộ file gốc** (docker-compose, scripts, docs cũ). Tôi đã **tạo lại từ đầu** toàn bộ project theo cấu trúc chuẩn.


-  `docker-compose.yml` - MinIO + Spark + Airflow + Metabase
-  `docker-compose-kafka.yml` - Kafka + Zookeeper + UI

-  `configs/spark-defaults.conf`
-  `configs/hive-site.xml`
-  `configs/minio_buckets.json`

-  `scripts/01_ingest_to_bronze.py` - CSV/JSON → Bronze
-  `scripts/02_transform_to_silver.py` - Bronze → Silver
-  `scripts/03_aggregate_to_gold.py` - Silver → Gold
-  `scripts/04_elt_pipeline.py` - Full pipeline
-  `scripts/05_kafka_producer.py` - Clickstream producer
-  `scripts/06_kafka_to_bronze_streaming.py` - Kafka → Bronze
-  `scripts/07_aggregate_clickstream_gold.py` - Stream Silver/Gold
-  `scripts/08_mock_data_generator.py` - Mock data
-  `scripts/09_tiki_crawler.py` - Tiki crawler
-  `scripts/10_multi_source_crawler.py` - GitHub/Crypto/Weather/HN
-  `scripts/11_ecommerce_streaming.py` - E-commerce stream
-  `scripts/generate_sample_data.py` - Sinh mock data
-  `scripts/utils/data_quality.py` - DQ checks
-  `scripts/utils/minio_helper.py` - MinIO helper
-  `scripts/utils/__init__.py`

-  `airflow_dags/retail_elt_dag.py`

-  `sql/01_business_metrics.sql`
-  `sql/02_customer_analytics.sql`
-  `sql/03_product_performance.sql`

-  `docs/01-architecture-overview.md`
-  `docs/02-medallion-architecture.md`
-  `docs/03-etl-vs-elt.md`
-  `docs/04-data-governance.md`
-  `docs/05-deployment.md`
-  `docs/06-summary.md`
-  `docs/07-gcp-setup-guide.md`
-  `docs/08-kafka-streaming-integration.md`
-  `docs/09-zero-data-pipeline-setup.md`
-  `docs/10-real-crawler-guide.md`

-  `README.md` - Tổng quan project


```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

python scripts/generate_sample_data.py

python scripts/01_ingest_to_bronze.py

docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/02_transform_to_silver.py

docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/03_aggregate_to_gold.py

```


 **Backup quan trọng!**

Lần sau hãy:
-  Push lên GitHub thường xuyên
-  Bật Time Machine backup
-  Sync lên Google Drive/iCloud
-  Dùng `git` để track mọi thay đổi

```bash
cd /Users/mac/Documents/data-lake-architecture
git init
git add .
git commit -m "Initial commit: Data Lake Architecture"
git remote add origin https://github.com/YOUR_USERNAME/data-lake-architecture.git
git push -u origin main
```
