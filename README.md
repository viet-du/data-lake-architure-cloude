# 🏗️ Data Lake Architecture

End-to-end **Data Lake** project với **Lambda Architecture** (Batch + Stream) sử dụng MinIO, Spark, Kafka, Delta Lake.

## 🎯 Tính năng

- ✅ **Medallion Architecture** (Bronze / Silver / Gold)
- ✅ **Batch ETL/ELT** với PySpark + Delta Lake
- ✅ **Real-time streaming** với Kafka + Spark Structured Streaming
- ✅ **Mock data generator** (không cần data thật) + **Real crawler** (Tiki, GitHub, Crypto, Weather)
- ✅ **Data Quality checks** với Great Expectations
- ✅ **Orchestration** với Apache Airflow
- ✅ **BI Dashboard** với Metabase
- ✅ **Cloud-ready** (GCP/AWS/Azure free tier)

## 🚀 Quick Start

```bash
# 1. Khởi động infrastructure
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

# 2. Sinh mock data
python scripts/generate_sample_data.py

# 3. Chạy pipeline
python scripts/01_ingest_to_bronze.py
docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/02_transform_to_silver.py
docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/03_aggregate_to_gold.py

# 4. Truy cập UI
# - MinIO:     http://localhost:9001 (minioadmin/minioadmin)
# - Spark UI:  http://localhost:8080
# - Airflow:   http://localhost:8088 (admin/admin)
# - Kafka UI:  http://localhost:8081
# - Metabase:  http://localhost:3000
```

## 📂 Cấu trúc

```
data-lake-architecture/
├── docker-compose.yml          # MinIO + Spark + Airflow + Metabase
├── docker-compose-kafka.yml    # Kafka + Zookeeper + UI
├── configs/                    # Spark/Hive config
├── scripts/                    # Python scripts
│   ├── 01_ingest_to_bronze.py
│   ├── 02_transform_to_silver.py
│   ├── 03_aggregate_to_gold.py
│   ├── 04_elt_pipeline.py
│   ├── 05_kafka_producer.py
│   ├── 06_kafka_to_bronze_streaming.py
│   ├── 07_aggregate_clickstream_gold.py
│   ├── 08_mock_data_generator.py
│   ├── 09_tiki_crawler.py
│   ├── 10_multi_source_crawler.py
│   ├── 11_ecommerce_streaming.py
│   ├── generate_sample_data.py
│   └── utils/
├── airflow_dags/               # Airflow DAGs
├── sql/                        # SQL queries
├── data-samples/               # Mock data (CSV/JSON)
└── docs/                       # Documentation
```

## 📚 Documentation

- [`docs/01-architecture-overview.md`](docs/01-architecture-overview.md) - Tổng quan
- [`docs/02-medallion-architecture.md`](docs/02-medallion-architecture.md) - Bronze/Silver/Gold
- [`docs/03-etl-vs-elt.md`](docs/03-etl-vs-elt.md) - ETL vs ELT
- [`docs/04-data-governance.md`](docs/04-data-governance.md) - DQ, Security
- [`docs/05-deployment.md`](docs/05-deployment.md) - Cloud deployment
- [`docs/08-kafka-streaming-integration.md`](docs/08-kafka-streaming-integration.md) - Kafka
- [`docs/09-zero-data-pipeline-setup.md`](docs/09-zero-data-pipeline-setup.md) - Setup với mock data
- [`docs/10-real-crawler-guide.md`](docs/10-real-crawler-guide.md) - Crawler thật

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Storage** | MinIO (S3-compatible) + Delta Lake |
| **Compute** | Apache Spark 3.4 |
| **Streaming** | Apache Kafka + Spark Structured Streaming |
| **Orchestration** | Apache Airflow 2.7 |
| **BI** | Metabase |
| **Language** | Python 3.11, SQL |

## 📊 Architecture

```
Sources:           Storage:           Processing:
- CSV/JSON    →   🥉 Bronze      →   Spark Batch
- Mock data   →   🥈 Silver      →   Spark Streaming
- Kafka       →   🥇 Gold        →   Airflow DAGs
- API (Tiki)                          Metabase BI
```

## 📝 License

MIT License - Free for educational use.
