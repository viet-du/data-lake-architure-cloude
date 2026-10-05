# 🚀 Setup Data Lake trên Databricks Community Edition

> ⭐ **Lựa chọn tốt nhất** cho sinh viên: **FREE FOREVER**, không cần credit card, Delta Lake có sẵn.

---

## 📋 Mục lục

1. [Tại sao Databricks?](#1-tại-sao-databricks)
2. [Đăng ký Databricks (2 phút)](#2-đăng-ký-databricks-2-phút)
3. [Cấu trúc Databricks](#3-cấu-trúc-databricks)
4. [Upload Data lên DBFS](#4-upload-data-lên-dbfs)
5. [Chạy ETL Pipeline](#5-chạy-etl-pipeline)
6. [Chạy Spark Streaming](#6-chạy-spark-streaming)
7. [Query Delta Lake](#7-query-delta-lake)
8. [Kết nối BI Tool](#8-kết-nối-bi-tool)
9. [Migrate từ Project hiện tại](#9-migrate-từ-project-hiện-tại)
10. [Giới hạn & Best practices](#10-giới-hạn--best-practices)

---

## 1. Tại sao Databricks?

### ✅ Ưu điểm

| Feature | Databricks Community | Local/MinIO |
|---------|---------------------|-------------|
| **Delta Lake** | ✅ Có sẵn | ⚙️ Cần config |
| **Spark** | ✅ Pre-installed | ⚙️ Cần cài |
| **Cluster** | ✅ 1 click tạo | ⚙️ Tự setup |
| **Notebooks** | ✅ UI tích hợp | ❌ Không có |
| **MLflow** | ✅ Có sẵn | ⚙️ Cần cài |
| **Sharing** | ✅ Share notebooks | ❌ Khó |
| **Cost** | **FREE FOREVER** | Cần VM/server |
| **Credit Card** | **Không cần** | Tùy |

### ❌ Nhược điểm

| Limit | Value |
|-------|-------|
| Cluster RAM | 15GB |
| Disk | 6GB |
| Runtime | Single node only |
| Users | 1 user |
| Clusters | 1 active at a time |

### 🎯 Khi nào đủ?

✅ Đồ án, học tập, demo
✅ Dataset < 5GB
✅ Không cần production
✅ Học Delta Lake, Spark, ML

---

## 2. Đăng ký Databricks (2 phút)

### 2.1. Truy cập

👉 https://www.databricks.com/

### 2.2. Chọn Community Edition

1. Click **"Get Started"** (góc trên bên phải)
2. Click **"Get Started Free"**
3. Click **"Community Edition"**
4. Click **"Get Started"**

### 2.3. Điền thông tin

```
Email: your-email@gmail.com
Password: **********
First Name: Your Name
Last Name: Your Name
```

### 2.4. Verify Email

- Mở email từ Databricks
- Click link verify

### 2.5. Đợi approval (1-2 phút)

- Databricks sẽ approve tự động
- Email thông báo khi xong

### 2.6. Login

1. https://community.cloud.databricks.com/
2. Nhập email + password
3. **Xong!** ✅

---

## 3. Cấu trúc Databricks

```
Databricks Community
│
├── Workspace
│   ├── User folder (/Users/your-email)
│   │   ├── Notebooks/
│   │   ├── Libraries/
│   │   └── DBFS/
│   │
│   └── Shared (if workspace created)
│
├── Clusters
│   └── Create single-node cluster
│
├── Data
│   ├── DBFS (Databricks File System)
│   ├── Tables (Delta tables)
│   └── File upload
│
└── Jobs
    └── Schedule notebooks
```

### 3.1. Tạo Cluster (1 lần)

1. Left sidebar → **Compute**
2. Click **"Create Compute"**
3. Cấu hình:

| Setting | Value |
|---------|-------|
| **Cluster name** | `data-lake-cluster` |
| **Cluster mode** | `Single Node` |
| **Runtime** | `14.2 (Scala 2.12, Spark 3.5)` |
| **Worker type** | (bỏ trống - single node) |
| **Python version** | `3` |
| **Access mode** | `Single User` |
| **User** | Your email |

4. Click **"Create Compute"**
5. Đợi ~3-5 phút cluster tạo xong

### 3.2. Workspace Structure

```
Workspace/
└── data-lake-architecture/
    ├── 01_ingest_to_bronze.py
    ├── 02_transform_to_silver.py
    ├── 03_aggregate_to_gold.py
    ├── 04_elt_pipeline.py
    └── sql/
        └── queries.sql
```

---

## 4. Upload Data lên DBFS

### 4.1. Cách 1: Upload trực tiếp (cho file nhỏ)

1. Left sidebar → **Data**
2. Click **"Add"** → **"Add Data"**
3. Click **"Upload"**
4. Kéo thả file CSV/JSON
5. Click **"Create Table"**
6. Chọn **"DBFS"** → đặt path: `/data/samples/`
7. Copy **Table name**: `samples.products`

### 4.2. Cách 2: Upload qua CLI (cho nhiều files)

```bash
# Cài Databricks CLI
pip install databricks-cli

# Configure
databricks configure --token
# URL: https://community.cloud.databricks.com
# Token: (lấy từ Databricks User Settings)

# Tạo thư mục
databricks fs mkdirs dbfs:/data/samples/

# Upload file
databricks fs cp products.csv dbfs:/data/samples/products.csv
databricks fs cp customers.csv dbfs:/data/samples/customers.csv

# Verify
databricks fs ls dbfs:/data/samples/
```

### 4.3. Cách 3: Tạo sample data trong Notebook

```python
# Tạo sample data trực tiếp trong Databricks
import pandas as pd
from datetime import datetime, timedelta
import random

random.seed(42)

# Customers
customers = pd.DataFrame({
    'customer_id': [f'C{i:05d}' for i in range(1, 201)],
    'first_name': random.choices(['Nguyen', 'Tran', 'Le'], k=200),
    'last_name': random.choices(['An', 'Binh', 'Cuong'], k=200),
    'email': [f'customer{i}@example.com' for i in range(1, 201)],
    'city': random.choices(['Ha Noi', 'TP HCM', 'Da Nang'], k=200),
    'age': [random.randint(18, 70) for _ in range(200)],
    'segment': random.choices(['VIP', 'Gold', 'Silver', 'Bronze'], k=200),
})

# Products
products = pd.DataFrame({
    'product_id': [f'P{i:05d}' for i in range(1, 51)],
    'product_name': [f'Product {i}' for i in range(1, 51)],
    'category': random.choices(['Electronics', 'Books', 'Fashion'], k=50),
    'price': [random.uniform(10, 3000) for _ in range(50)],
    'stock_quantity': [random.randint(0, 500) for _ in range(50)],
})

# Save to DBFS
customers.to_csv('/dbfs/data/samples/customers.csv', index=False)
products.to_csv('/dbfs/data/samples/products.csv', index=False)

print(f"✅ Uploaded {len(customers)} customers, {len(products)} products")
```

---

## 5. Chạy ETL Pipeline

### 5.1. Tạo Notebook

1. Left sidebar → **Workspace**
2. Click **"+"** → **"Notebook"**
3. Name: `01_ETL_Pipeline`
4. Attach to cluster: `data-lake-cluster`

### 5.2. Bronze Layer

```python
# ============================================================
# Notebook: 01_ETL_Pipeline - Bronze to Gold
# ============================================================

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from delta import configure_spark_with_delta_pip

# Create Spark session with Delta Lake
spark = (
    SparkSession.builder
    .appName("Data Lake ETL")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    .getOrCreate()
)

print(f"Spark version: {spark.version}")
print(f"Delta version: {spark.conf.get('spark.sql.catalog.spark_catalog')}")

# ============================================================
# BRONZE LAYER
# ============================================================
print("\n🥉 BRONZE LAYER: Ingesting raw data...")

# Read from DBFS
customers_bronze = (
    spark.read
    .option("header", True)
    .csv("dbfs:/data/samples/customers.csv")
    .withColumn("_ingestion_timestamp", F.current_timestamp())
    .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
)

products_bronze = (
    spark.read
    .option("header", True)
    .csv("dbfs:/data/samples/products.csv")
    .withColumn("_ingestion_timestamp", F.current_timestamp())
    .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
)

# Write to Delta Lake (Bronze)
customers_bronze.write.format("delta").mode("overwrite").partitionBy("_ingestion_date").save("dbfs:/data/bronze/customers/")
products_bronze.write.format("delta").mode("overwrite").partitionBy("_ingestion_date").save("dbfs:/data/bronze/products/")

print(f"✅ Bronze: {customers_bronze.count()} customers, {products_bronze.count()} products")
```

### 5.3. Silver Layer

```python
# ============================================================
# SILVER LAYER
# ============================================================
print("\n🥈 SILVER LAYER: Cleaning and validating...")

# Read Bronze
customers_silver = spark.read.format("delta").load("dbfs:/data/bronze/customers/")
products_silver = spark.read.format("delta").load("dbfs:/data/bronze/products/")

# Clean customers
customers_clean = (
    customers_silver
    .filter(F.col("customer_id").isNotNull())
    .filter(F.col("email").contains("@"))
    .withColumn("email", F.lower(F.trim(F.col("email"))))
    .withColumn("full_name", F.trim(F.concat_ws(" ", F.col("first_name"), F.col("last_name"))))
    .withColumn("age_group",
                F.when(F.col("age") < 25, "young")
                .when(F.col("age") < 50, "middle")
                .otherwise("senior"))
    .dropDuplicates(["customer_id"])
)

# Clean products
products_clean = (
    products_silver
    .filter(F.col("product_id").isNotNull())
    .filter(F.col("price") > 0)
    .withColumn("price_tier",
                F.when(F.col("price") < 100, "budget")
                .when(F.col("price") < 1000, "mid")
                .otherwise("premium"))
    .dropDuplicates(["product_id"])
)

# Write Silver
customers_clean.write.format("delta").mode("overwrite").save("dbfs:/data/silver/customers/")
products_clean.write.format("delta").mode("overwrite").save("dbfs:/data/silver/products/")

print(f"✅ Silver: {customers_clean.count()} customers, {products_clean.count()} products")
```

### 5.4. Gold Layer

```python
# ============================================================
# GOLD LAYER
# ============================================================
print("\n🥇 GOLD LAYER: Business aggregations...")

# Read Silver
customers = spark.read.format("delta").load("dbfs:/data/silver/customers/")
products = spark.read.format("delta").load("dbfs:/data/silver/products/")

# Product summary
product_summary = (
    products
    .groupBy("category")
    .agg(
        F.count("*").alias("num_products"),
        F.avg("price").alias("avg_price"),
        F.sum("stock_quantity").alias("total_stock"),
        F.max("price").alias("max_price"),
        F.min("price").alias("min_price"),
    )
)

# Customer summary
customer_summary = (
    customers
    .groupBy("segment")
    .agg(
        F.count("*").alias("num_customers"),
        F.avg("age").alias("avg_age"),
    )
)

# Write Gold
product_summary.write.format("delta").mode("overwrite").save("dbfs:/data/gold/product_summary/")
customer_summary.write.format("delta").mode("overwrite").save("dbfs:/data/gold/customer_summary/")

print(f"✅ Gold: {product_summary.count()} categories, {customer_summary.count()} segments")
```

### 5.5. Chạy toàn bộ

1. Attach notebook vào cluster
2. Click **"Run All"** (nút ▶️)
3. Xem output trong cells

---

## 6. Chạy Spark Streaming

### 6.1. Tạo Notebook: Real-time Analytics

```python
# ============================================================
# Notebook: Real-time Analytics
# ============================================================

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType

# Create streaming session
spark = (
    SparkSession.builder
    .appName("Real-time Analytics")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    .getOrCreate()
)

# Schema cho streaming data
schema = StructType([
    StructField("product_id", StringType(), True),
    StructField("category", StringType(), True),
    StructField("price", DoubleType(), True),
    StructField("order_count", IntegerType(), True),
    StructField("event_time", StringType(), True),
])

# ============================================================
# Tạo mock stream (thay bằng real Kafka source nếu có)
# ============================================================

# Đọc từ Delta table như streaming source
streaming_df = (
    spark.readStream
    .format("delta")
    .option("ignoreChanges", "true")
    .load("dbfs:/data/bronze/products/")
)

# Transform
category_metrics = (
    streaming_df
    .groupBy("category")
    .agg(
        F.count("*").alias("product_count"),
        F.avg("price").alias("avg_price"),
    )
)

# Write to Gold
query = (
    category_metrics.writeStream
    .format("delta")
    .outputMode("complete")
    .option("checkpointLocation", "dbfs:/data/checkpoints/category_metrics/")
    .start("dbfs:/data/gold/category_streaming/")
)

print(f"✅ Streaming started: {query.id}")
query.awaitTermination()
```

---

## 7. Query Delta Lake

### 7.1. SQL trong Notebook

```sql
-- Xem Bronze layer
SELECT * FROM delta.`dbfs:/data/bronze/customers/` LIMIT 10;

-- Xem Silver layer
SELECT * FROM delta.`dbfs:/data/silver/customers/` LIMIT 10;

-- Xem Gold layer
SELECT * FROM delta.`dbfs:/data/gold/product_summary/`;

-- Business query: Revenue by category
SELECT 
    category,
    num_products,
    ROUND(avg_price, 2) as avg_price,
    total_stock
FROM delta.`dbfs:/data/gold/product_summary/`
ORDER BY total_stock DESC;

-- Customer segments
SELECT 
    segment,
    num_customers,
    ROUND(avg_age, 1) as avg_age
FROM delta.`dbfs:/data/gold/customer_summary/`
ORDER BY num_customers DESC;
```

### 7.2. Query từ Python

```python
# Query Delta Lake bằng SQL
result = spark.sql("""
    SELECT 
        category,
        SUM(price) as total_revenue
    FROM delta.`dbfs:/data/silver/products/`
    GROUP BY category
    ORDER BY total_revenue DESC
""")

display(result)  # Hiển thị dạng bảng trong Databricks
```

---

## 8. Kết nối BI Tool

### 8.1. Databricks SQL Endpoint (có phí, $ không bắt buộc)

Databricks Community **không có** SQL Endpoint. Thay thế:

1. **Metabase** (free): Kết nối JDBC → Databricks
2. **DBeaver** (free): Query trực tiếp
3. **Tableau Public** (free): Visualize

### 8.2. Kết nối DBeaver (đề xuất)

```bash
# 1. Download DBeaver: https://dbeaver.io/
# 2. Install Databricks JDBC driver
#    Help → Install Driver → Search "Databricks"

# 3. New Connection → Databricks
#    Host: https://community.cloud.databricks.com
#    Token: (lấy từ Databricks User Settings)
#    HTTP Path: /sql/1.0/warehouses/...

# 4. Query!
SELECT * FROM delta.`dbfs:/data/gold/product_summary/`;
```

### 8.3. Kết nối Metabase

```bash
# 1. Chạy Metabase local
docker run -d -p 3000:3000 --name metabase metabase/metabase

# 2. Mở http://localhost:3000
# 3. Add Database → Databricks
# 4. Điền:
#    - Host: community.cloud.databricks.com
#    - Port: 443
#    - Database: default
#    - HTTP Path: /sql/1.0/warehouses/...
#    - User: token
#    - Password: YOUR_TOKEN

# 5. Query & visualize!
```

---

## 9. Migrate từ Project hiện tại

### 9.1. Local → Databricks

**Scripts cần thay đổi:**

| Local Path | Databricks Path |
|------------|----------------|
| `s3a://bronze/` | `dbfs:/data/bronze/` |
| `s3a://silver/` | `dbfs:/data/silver/` |
| `s3a://gold/` | `dbfs:/data/gold/` |
| `localhost:9000` | (bỏ - DBFS có sẵn) |

### 9.2. File cần tạo lại

```
Databricks Workspace/
└── data-lake-architecture/
    │
    ├── Notebooks/
    │   ├── 01_Data_Ingestion.py     # Từ 01_ingest_to_bronze.py
    │   ├── 02_Data_Transform.py     # Từ 02_transform_to_silver.py
    │   ├── 03_Data_Aggregate.py     # Từ 03_aggregate_to_gold.py
    │   └── 04_Real_Time.py          # Từ 05-07 (streaming)
    │
    └── Data/
        ├── samples/                  # CSV/JSON mẫu
        ├── bronze/                   # Delta tables
        ├── silver/                   # Delta tables
        └── gold/                     # Delta tables
```

### 9.3. Upload Scripts lên Databricks

```bash
# Cách 1: Databricks CLI
databricks workspace import_dir ./scripts /Workspace/data-lake-architecture/scripts

# Cách 2: Upload từng file
# 1. Databricks UI → Workspace → Import
# 2. Kéo thả .py file

# Cách 3: Git integration
# 1. Settings → User Settings → GitHub integration
# 2. Link repo
```

---

## 10. Giới hạn & Best practices

### 10.1. Giới hạn

| Resource | Limit |
|----------|-------|
| Cluster RAM | 15GB |
| Disk | 6GB |
| Concurrent notebooks | 1 |
| Notebook size | 1MB |
| Table size | 20GB |

### 10.2. Best practices

**✅ NÊN:**

```python
# 1. Partition data lớn
df.write.format("delta").partitionBy("date").save("dbfs:/data/...")

# 2. Optimize Delta tables
spark.sql("OPTIMIZE delta.`dbfs:/data/gold/product_summary/`")

# 3. Vacuum old files
spark.sql("VACUUM delta.`dbfs:/data/gold/product_summary/` RETAIN 7 HOURS")

# 4. Cache small tables
spark.table("silver_customers").cache()

# 5. Use display() cho visualize
display(df)
```

**❌ KHÔNG NÊN:**

```python
# ❌ Đọc toàn bộ data vào memory
df.collect()  # Chỉ dùng khi data nhỏ

# ❌ Collect() cho data lớn
result = df.collect()  # Có thể crash cluster

# ❌ Shuffle operations trên data lớn
df.join(df2, "key")  # Cẩn thận với data lớn
```

### 10.3. Optimize cho Community Edition

```python
# 1. Xử lý theo batch
for partition in df.randomSplit([0.1, 0.9]):
    process(partition)

# 2. Dùng coalesce để giảm partitions
df.coalesce(1).write...

# 3. Chỉ query cần thiết
df.select("col1", "col2").filter(...)

# 4. Dùng Spark SQL thay vì Pandas
spark.sql("SELECT ...").show()
```

---

## 📊 Tổng kết

### ✅ Bạn có gì với Databricks Community?

| Feature | Có? |
|---------|------|
| Delta Lake | ✅ |
| PySpark | ✅ |
| Notebooks | ✅ |
| SQL Editor | ✅ |
| MLflow | ✅ |
| Cluster management | ✅ |
| Real-time streaming | ✅ |
| File upload | ✅ |
| Share notebooks | ✅ |
| **Cost** | **$0 FOREVER** |

### 🚀 Workflow

```
1. Upload data lên DBFS
2. Tạo Notebook
3. Attach cluster
4. Run ETL (Bronze → Silver → Gold)
5. Query Delta tables
6. Visualize với display()
7. Share notebooks
```

---

## ❓ Troubleshooting

| Lỗi | Fix |
|------|-----|
| Cluster stuck in "Starting" | Đợi 5-10 phút hoặc restart |
| OutOfMemoryError | Giảm data size, dùng `.coalesce(1)` |
| Token expired | Settings → User Settings → Generate new token |
| Can't upload >10MB | Dùng CLI hoặc split file |
| Notebook timeout | Reduce computation, add checkpoints |

---

**Bạn đã sẵn sàng dùng Databricks!** 🎉

Truy cập: https://community.cloud.databricks.com/