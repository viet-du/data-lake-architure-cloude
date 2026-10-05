# 🎯 End-to-End Demo: Redpanda → Spark → MinIO → Metabase

> Pipeline streaming hoàn chỉnh, từ click events real-time đến BI dashboards.

---

## 📋 Luồng dữ liệu

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Producer   │──▶│  Redpanda   │──▶│    Spark    │──▶│   MinIO     │
│ (Python)    │   │   (Kafka)   │   │  Streaming   │   │ (Delta Lake)│
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                                                                 │
                   ┌─────────────┐   ┌─────────────┐           │
                   │  Metabase   │◀──│   Spark     │◀──────────┘
                   │ (Dashboard) │   │   (Batch)   │
                   └─────────────┘   └─────────────┘
```

```
[Producer] → gửi events → [Redpanda topic]
                          ↓
                   [Spark Streaming] → [Bronze Delta Lake trên MinIO]
                                                ↓
                                  [Spark Batch ETL] → [Silver Delta Lake]
                                                       ↓
                                                [Gold Delta Lake]
                                                    ↓
                                              [Metabase BI]
```

---

## 📁 Files đã tạo

```
scripts/demo/
├── 00_README.py            # Tổng quan demo
├── 01_producer.py          # Gửi clickstream events vào Redpanda
├── 02_spark_streaming.py   # Spark Streaming: Redpanda → Bronze
├── 03_batch_etl.py         # Batch ETL: Bronze → Silver → Gold
└── 04_gold_queries.sql     # SQL queries cho Metabase
```

---

## 🚀 Cách chạy (5 bước)

### Bước 1: Mở Docker Desktop

Docker phải đang chạy.

### Bước 2: Start toàn bộ stack

```bash
cd /Users/mac/Documents/data-lake-architecture

# Start tất cả services
docker compose up -d

# Verify
docker ps
```

Containers chạy:
- `lake-redpanda` (port 9092)
- `lake-redpanda-console` (port 8081)
- `lake-minio` (port 9000)
- `lake-spark-master` (port 8080)
- `lake-metabase` (port 3000)

### Bước 3: Tạo topic Redpanda

```bash
# Vào container Redpanda
docker exec -it lake-redpanda rpk topic create clickstream-events --partitions 3

# Verify
docker exec -it lake-redpanda rpk topic list
```

### Bước 4: Chạy Producer (Terminal 1)

Mở Terminal 1:

```bash
cd /Users/mac/Documents/data-lake-architecture

# Cài thư viện Python (nếu chưa có)
pip install kafka-python

# Chạy producer
python3 scripts/demo/01_producer.py
```

Producer sẽ gửi **5 events/giây** vào topic `clickstream-events`.

Output mẫu:
```
🔌 Connecting to Redpanda at localhost:9092...
✅ Connected!
📤 Sending to topic: clickstream-events
⚡ Rate: 5 events/second

📤 Sent 10 events | Type: click           | Page: home
📤 Sent 20 events | Type: purchase        | Page: checkout
📤 Sent 30 events | Type: page_view       | Page: products
```

### Bước 5: Chạy Spark Streaming (Terminal 2)

Mở Terminal 2:

```bash
# Chạy Spark Streaming trong container
docker exec -it lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0,org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0 \
  /scripts/demo/02_spark_streaming.py
```

Spark sẽ:
- ✅ Đọc real-time từ Redpanda
- ✅ Parse JSON
- ✅ Ghi vào `s3a://bronze/clickstream/events/` (Delta Lake trên MinIO)
- ✅ Batch mỗi 10 giây

Output mẫu:
```
🚀 Creating Spark session...
✅ Spark version: 3.4.0
📥 Reading from Redpanda topic 'clickstream-events'...
💾 Writing to MinIO: s3a://bronze/clickstream/events/

🎧 Listening... (Press Ctrl+C to stop)

=============================================
  Batch: 1
=============================================
+--------------------+----------+--------+---------+
|            event_id| user_id  |  page  | category|
+--------------------+----------+--------+---------+
|  evt_1696512345_0  |user_00123|  home  |  books  |
|  evt_1696512345_1  |user_00045|product |  sports |
+--------------------+----------+--------+---------+
```

---

## 📊 Step 6: Chạy Batch ETL (Tạo Silver + Gold)

Sau khi đã có data trong Bronze (đợi ~5 phút), chạy batch ETL:

```bash
docker exec -it lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/demo/03_batch_etl.py
```

Output:
```
🚀 Creating Spark session...
🥉 Reading Bronze layer: s3a://bronze/clickstream/events/
📊 Bronze records: 1500

🥈 Cleaning → Silver layer...
✅ Silver records: 1498

🥇 Gold Layer 1: Revenue by category...
💾 Writing Gold: s3a://gold/clickstream/revenue_by_category/
+------------+--------------+--------------+--------------+
|    category|num_purchases| total_revenue|unique_buyers |
+------------+--------------+--------------+--------------+
|electronics |          142         |   85420.50  |          87  |
|   books    |           98         |   32100.25  |          54  |
|   fashion  |          134         |   28900.75  |          78  |
+------------+--------------+--------------+--------------+
```

---

## 🎨 Step 7: Visualize với Metabase

### 7.1. Setup Metabase

1. Mở **http://localhost:3000**
2. Tạo account admin lần đầu
3. Click **"Add database"**

### 7.2. Connect to MinIO/Delta Lake

⚠️ Metabase không support Delta Lake trực tiếp. Có 2 cách:

**Cách 1: Dùng Spark JDBC Server**

```bash
# Trong spark-master container
docker exec -it lake-spark-master /opt/bitnami/spark/sbin/start-thriftserver.sh \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0
```

Metabase connect: `jdbc:hive2://spark-master:10000/default`

**Cách 2: Dùng Athena/Trino**

Cài Trino để query Delta Lake từ Metabase.

**Cách 3: Dùng SQL Queries qua Notebook**

```bash
docker exec -it lake-spark-master spark-sql \
  -f /scripts/demo/04_gold_queries.sql
```

### 7.3. Tạo dashboard

Sau khi connect, tạo questions:

- 📊 **Revenue by Category** (Bar chart)
- 📈 **Active Users by Hour** (Line chart)
- 🏆 **Top Products** (Table)
- 🎯 **Conversion Funnel** (Funnel chart)

---

## 🌐 Các Web UI để theo dõi

| Service | URL | Xem gì |
|---------|-----|--------|
| **Redpanda Console** | http://localhost:8081 | Topics, messages real-time |
| **Kafka UI** | http://localhost:8089 | Topics, brokers |
| **MinIO Console** | http://localhost:9001 | Buckets, files |
| **Spark Master UI** | http://localhost:8080 | Jobs, executors |
| **Spark App UI** | http://localhost:4040 | Streaming jobs |
| **Airflow** | http://localhost:8088 | DAGs (optional) |
| **Metabase** | http://localhost:3000 | BI Dashboards |

---

## 🎬 Demo Workflow (5 phút)

```
T+0:00  → docker compose up -d                   (30s)
T+0:30  → rpk topic create clickstream-events    (5s)
T+0:35  → python3 scripts/demo/01_producer.py    (terminal 1)
T+0:40  → docker exec spark-submit ...           (terminal 2)
T+2:00  → Browser: http://localhost:8081         (xem messages)
T+3:00  → Browser: http://localhost:9001         (xem Bronze files)
T+5:00  → docker exec spark-submit ... 03_batch  (tạo Silver/Gold)
T+6:00  → Browser: http://localhost:3000         (Metabase)
```

---

## 📊 Data flow chi tiết

### Bronze Layer (Raw events)

```
s3a://bronze/clickstream/events/
├── _ingestion_date=2026-10-05/
│   ├── part-00000.parquet
│   ├── part-00001.parquet
│   └── _delta_log/
│       ├── 00000000000000000000.json
│       └── 00000000000000000001.json
```

### Silver Layer (Cleaned)

```
s3a://silver/clickstream/events/
├── event_date=2026-10-05/
│   ├── part-00000.parquet
│   └── _delta_log/
```

### Gold Layer (Aggregations)

```
s3a://gold/clickstream/
├── revenue_by_category/      # Doanh thu theo category
├── active_users/             # Active users theo giờ
└── top_products/             # Top sản phẩm
```

---

## 🧪 Test End-to-End

### Tạo data nhanh

```bash
# Terminal 1: Producer gửi nhanh (100 events/giây)
python3 scripts/demo/01_producer.py
# Sửa EVENTS_PER_SECOND = 100 trong file
```

### Xem data real-time

```bash
# Xem messages trong topic
docker exec -it lake-redpanda rpk topic consume clickstream-events --follow

# Xem Bronze files
docker exec -it lake-minio mc ls local/bronze/clickstream/events/ --recursive

# Query Gold layer
docker exec -it lake-spark-master spark-sql \
  -e "SELECT * FROM delta.\`s3a://gold/clickstream/revenue_by_category/\`"
```

---

## 🛠️ Troubleshooting

### Producer không connect

```bash
# Check Redpanda đang chạy
docker ps | grep redpanda

# Check port 9092
lsof -i :9092

# Test từ terminal
docker exec -it lake-redpanda rpk cluster health
```

### Spark Streaming lỗi

```bash
# Check Kafka package
docker exec -it lake-spark-master spark-shell \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0

# Check MinIO connectivity
docker exec -it lake-spark-master curl -I http://minio:9000
```

### Delta Lake lỗi

```bash
# Check Delta package version
docker exec -it lake-spark-master spark-shell \
  --packages io.delta:delta-spark_2.12:3.0.0
```

---

## 🎁 Bonus: Auto-run với Airflow

Tạo DAG chạy pipeline theo lịch:

```python
# airflow_dags/clickstream_pipeline.py
from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 10, 1),
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'clickstream_pipeline',
    default_args=default_args,
    schedule_interval=timedelta(hours=1),
    catchup=False,
)

t1 = BashOperator(
    task_id='spark_batch_etl',
    bash_command='docker exec lake-spark-master spark-submit '
                 '--packages io.delta:delta-spark_2.12:3.0.0 '
                 '/scripts/demo/03_batch_etl.py',
    dag=dag,
)
```

---

## ✅ Kết quả cuối cùng

Sau khi chạy xong, bạn có:

| Layer | Data | Storage |
|-------|------|---------|
| 🥉 Bronze | Raw events (JSON → Delta) | MinIO |
| 🥈 Silver | Cleaned, validated | MinIO |
| 🥇 Gold | Business metrics | MinIO |
| 📊 Metabase | Interactive dashboards | - |
| 🐼 Redpanda | Streaming events | Kafka API |

**Toàn bộ data lake architecture chạy local, free, dễ demo!** 🎉