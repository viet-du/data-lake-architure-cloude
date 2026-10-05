# 11 – Multi-Thread Kafka Crawler: Phân tích doanh số theo danh mục

> 🎯 **Mục tiêu**: Setup hệ thống **crawler đa luồng** → **Kafka** → **Spark Streaming** → **Delta Lake Gold** để phân tích **doanh số real-time theo danh mục sản phẩm** từ Tiki.vn.

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan)
2. [Cài đặt](#2-cài-đặt)
3. [Crawler đa luồng (script 12)](#3-crawler-đa-luồng)
4. [Spark Streaming xử lý (script 13)](#4-spark-streaming)
5. [Phân tích doanh số (SQL queries)](#5-phân-tích-doanh-số)
6. [Demo end-to-end](#6-demo)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────────────┐
│   Multi-Thread Crawler + Kafka + Spark Streaming Architecture   │
│                                                                  │
│   CRAWLER (8 threads)              KAFKA                        │
│   ┌──────────────────┐             ┌──────────────────┐        │
│   │ Thread 1: Phone  │ ──events──► │                  │        │
│   │ Thread 2: Laptop │             │ tiki-category-    │        │
│   │ Thread 3: Fashion│             │ stream (3 partit) │        │
│   │ Thread 4: Beauty │             │                  │        │
│   │ Thread 5: Home   │             │  key=category:    │        │
│   │ Thread 6: Books  │             │  product_id       │        │
│   │ Thread 7: Sports │             │  (partition by    │        │
│   │ Thread 8: Mom&Baby│             │   category)       │        │
│   └──────────────────┘             └────────┬─────────┘        │
│                                                │                  │
│                                                ▼                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │   SPARK STRUCTURED STREAMING                          │      │
│   │   • Read từ Kafka                                     │      │
│   │   • Parse JSON schema                                 │      │
│   │   • Bronze: raw data                                  │      │
│   │   • Silver: clean, validate, enrich (revenue)         │      │
│   │   • Gold: real-time metrics                           │      │
│   └──────────────────────┬───────────────────────────────┘      │
│                          ▼                                        │
│   ┌──────────────────────────────────────────────────────┐      │
│   │   DELTA LAKE GOLD (4 tables)                          │      │
│   │   🥇 revenue_by_category: doanh thu/category/5min    │      │
│   │   🥇 top_products_by_category: top 10 sp/category     │      │
│   │   🥇 parent_category_summary: tổng hợp               │      │
│   │   🥇 discount_analysis: phân tích giảm giá           │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                  │
│   BI: Metabase / Streamlit dashboard                            │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Cài đặt

### 2.1. Yêu cầu
- Docker (MinIO, Spark, Kafka đang chạy)
- Python 3.9+
- 8GB RAM trở lên

### 2.2. Cài packages
```bash
pip install requests kafka-python pyspark delta-spark
```

### 2.3. Tạo Kafka topic
```bash
# Topic đã tự tạo khi docker-compose up, verify:
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list
# Expected: tiki-category-stream

# Nếu chưa có:
docker exec lake-kafka kafka-topics \
  --bootstrap-server localhost:29092 \
  --create --topic tiki-category-stream \
  --partitions 3 --replication-factor 1
```

### 2.4. Tạo Delta Lake buckets
```bash
docker exec lake-minio mc mb -p local/bronze/tiki --ignore-existing
docker exec lake-minio mc mb -p local/silver/tiki --ignore-existing
docker exec lake-minio mc mb -p local/gold/category_analytics --ignore-existing
```

## 3. Crawler đa luồng (script 12)

### 3.1. Tính năng

- ✅ **28 categories** đầy đủ (Electronics, Fashion, Beauty, Home, Books, Sports, Mom & Baby)
- ✅ **8 threads** chạy song song (configurable)
- ✅ **Thread-safe Kafka producer** (với Lock + queue)
- ✅ **Auto retry** khi 403/500
- ✅ **File backup** (.jsonl.gz) phòng khi Kafka fail
- ✅ **Stats tracking** real-time
- ✅ **Rate limiting** thông minh

### 3.2. Chạy

```bash
# 1. Crawl tất cả 28 categories, 8 threads, 3 pages mỗi category
python scripts/12_multithread_category_crawler.py --workers 8 --pages 3
# → ~28 × 3 × 40 = 3,360 products

# 2. Chỉ electronics + fashion, 4 threads, 5 pages
python scripts/12_multithread_category_crawler.py \
  --workers 4 --pages 5 \
  --groups electronics,fashion
# → ~12 × 5 × 40 = 2,400 products

# 3. Chỉ crawl 3 categories cụ thể
python scripts/12_multithread_category_crawler.py \
  --categories smartphone,laptop,thoi-trang-nu \
  --workers 3 --pages 5
```

### 3.3. Output mẫu

```
============================================================
🕷️  Multi-thread Tiki Category Crawler
   Workers: 8
   Pages/category: 3
   Categories: 28
   Kafka: localhost:9092
   Topic: tiki-category-stream
============================================================
🔌 Connecting to Kafka...
✅ Kafka Producer connected: ['localhost:9092'], topic=tiki-category-stream
🚀 Starting 8 threads for 28 categories...

  🧵 [smartphone] Start: Điện thoại Smartphone
  🧵 [laptop] Start: Laptop
  🧵 [thoi-trang-nu] Start: Thời trang nữ
  🧵 [my-pham] Start: Mỹ phẩm
  ...
  📊 [smartphone] Page 2: 40 products (total: 80)
  📊 [laptop] Page 2: 40 products (total: 80)
  ✅ [smartphone] Done: 120 products, 0 errors
  ✅ [laptop] Done: 120 products, 0 errors
  ...

============================================================
🎉 CRAWL COMPLETED in 145.3s
   Total products: 3,360
   Categories: 28
   Parent categories: 6
   Throughput: 23.1 products/sec
============================================================

📊 TOP 10 categories theo số lượng:
   smartphone                     :   120 products
   laptop                         :   120 products
   thoi-trang-nu                  :   120 products
   my-pham                        :   120 products
   ...

📊 Doanh số (tổng products) theo parent category:
   electronics            :   720 products
   fashion                :   480 products
   beauty                 :   480 products
   home                   :   360 products
   books                  :   360 products
   sports                 :   120 products
   mom-baby               :   240 products
```

### 3.4. Data Schema

Mỗi event gửi vào Kafka:

```json
{
  "id": 195612559,
  "name": "iPhone 15 Pro Max 256GB",
  "sku": "8901234567890",
  "price": 29990000,
  "original_price": 34990000,
  "discount": 5000000,
  "discount_rate": 14.3,
  "rating_average": 4.7,
  "review_count": 1234,
  "order_count": 5678,           // ⭐ Số lượng đã bán
  "favourite_count": 890,
  "category_key": "smartphone",  // ⭐ Dùng để partition
  "category_name": "Điện thoại Smartphone",
  "category_id": 1789,
  "parent_category": "electronics",
  "brand_name": "Apple",
  "seller_id": 12345,
  "seller_name": "Tiki Trading",
  "is_authentic": true,
  "is_visible": true,
  "_crawl_id": "abc-123-def",
  "_crawl_timestamp": "2024-10-05T22:00:00Z",
  "_crawl_date": "2024-10-05",
  "_source": "tiki.vn",
  "_thread": "ThreadPoolExecutor-0_3"
}
```

## 4. Spark Streaming xử lý (script 13)

### 4.1. Tính năng

- ✅ **Schema enforcement**: Đảm bảo data đúng format
- ✅ **Data enrichment**: Tính `revenue_estimate`, `popularity_score`, `sales_tier`
- ✅ **Watermark**: 30 phút (tránh late data)
- ✅ **4 Gold tables**:
  1. `revenue_by_category`: Doanh thu/category/5min
  2. `top_products_by_category`: Top 10 sp/category
  3. `parent_category_summary`: Tổng hợp theo parent
  4. `discount_analysis`: Phân tích discount

### 4.2. Chạy

```bash
# 1. Đảm bảo crawler đang chạy (terminal khác)
python scripts/12_multithread_category_crawler.py

# 2. Submit Spark job (terminal này)
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/13_category_revenue_streaming.py
```

### 4.3. 4 Gold Tables

#### Table 1: `revenue_by_category`
```sql
SELECT
  window_start,
  category_name,
  parent_category,
  product_count,
  total_units_sold,
  total_revenue_estimate,
  avg_price,
  avg_rating,
  avg_discount_rate
FROM delta.`s3a://gold/category_analytics/revenue_by_category/`
ORDER BY window_start DESC, total_revenue_estimate DESC;
```

#### Table 2: `top_products_by_category`
```sql
SELECT
  category_name,
  top_10_products  -- Array of {product_id, name, order_count, revenue, price, ...}
FROM delta.`s3a://gold/category_analytics/top_products_by_category/`
ORDER BY window_start DESC;
```

#### Table 3: `parent_category_summary`
```sql
SELECT
  parent_category,
  total_products,
  num_subcategories,
  total_units_sold,
  total_revenue,
  avg_price,
  num_brands
FROM delta.`s3a://gold/category_analytics/parent_category_summary/`
ORDER BY window_start DESC, total_revenue DESC;
```

#### Table 4: `discount_analysis`
```sql
SELECT
  category_key,
  discount_tier,
  product_count,
  avg_price,
  total_discount_value,
  avg_units_sold
FROM delta.`s3a://gold/category_analytics/discount_analysis/`
ORDER BY category_key, discount_tier;
```

## 5. Phân tích doanh số (SQL queries)

Xem chi tiết trong `sql/04_category_revenue.sql`:

| Query | Mô tả |
|-------|-------|
| **4.1** | Top 10 parent categories theo doanh thu |
| **4.2** | Doanh thu từng category (chi tiết) |
| **4.3** | Time series doanh thu theo giờ |
| **4.4** | Top 10 best sellers per category |
| **4.5** | Phân tích discount theo category |
| **4.6** | Market share theo parent category |
| **4.7** | Growth rate (5-min vs 5-min trước) |
| **4.8** | Categories có nhiều bestseller |

### Chạy queries

```bash
# Query đơn lẻ
docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "$(cat sql/04_category_revenue.sql | head -50)"

# Query file đầy đủ
docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -f sql/04_category_revenue.sql
```

## 6. Demo end-to-end

### 6.1. Setup (1 lần)

```bash
# Khởi động infrastructure
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

# Verify services
docker ps
```

### 6.2. Demo (3 terminals)

**Terminal 1: Crawler (sinh data)**
```bash
python scripts/12_multithread_category_crawler.py --workers 8 --pages 3
# → Crawl 28 categories, ~3,360 products
# → Gửi vào Kafka topic `tiki-category-stream`
```

**Terminal 2: Spark Streaming (xử lý)**
```bash
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/13_category_revenue_streaming.py
# → Đọc từ Kafka, xử lý, ghi 4 Gold tables
```

**Terminal 3: Query real-time**
```bash
# Xem doanh thu theo category
docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "
    SELECT
      parent_category,
      SUM(total_revenue) AS revenue,
      SUM(total_units_sold) AS units_sold,
      SUM(num_subcategories) AS subcategories
    FROM delta.\`s3a://gold/category_analytics/parent_category_summary/\`
    WHERE window_start > current_timestamp() - INTERVAL 10 MINUTES
    GROUP BY parent_category
    ORDER BY revenue DESC
  "
```

**Browser: Kafka UI**
```
http://localhost:8081
→ Topic: tiki-category-stream
→ Xem messages real-time
→ Xem throughput
```

**Browser: MinIO Console**
```
http://localhost:9001 (minioadmin/minioadmin)
→ Bucket: gold/category_analytics/
→ 4 folders: revenue_by_category, top_products_by_category, ...
```

### 6.3. Output mong đợi

Sau khi chạy, bạn sẽ thấy:

**Bronze** (`s3a://bronze/tiki/categories/`):
- 3,360 raw products
- Partitioned by `_processing_date`

**Silver** (`s3a://silver/tiki/categories/`):
- 3,360 cleaned products
- Có `revenue_estimate`, `popularity_score`, `sales_tier`
- Partitioned by `processing_date, parent_category`

**Gold** (4 tables):

```
s3a://gold/category_analytics/
├── revenue_by_category/
│   └── _processing_date=2024-10-05/
│       ├── parent_category=electronics/
│       │   ├── category_key=smartphone/
│       │   └── category_key=laptop/
│       ├── parent_category=fashion/
│       └── ...
├── top_products_by_category/
├── parent_category_summary/
└── discount_analysis/
```

## 7. Troubleshooting

### 7.1. Crawler bị 403

```
⚠️  [smartphone] Rate limited, sleeping 30s...
```

**Fix**: Tăng delay giữa các request:
```python
# Trong script 12, tăng delay:
time.sleep(random.uniform(1.5, 2.5))  # Thay vì 0.5-1.0
```

### 7.2. Kafka producer fail

```
❌ Kafka send failed: NoBrokersAvailable
```

**Fix**: Kiểm tra Kafka đang chạy:
```bash
docker ps | grep kafka
docker logs lake-kafka | tail -20
```

### 7.3. Spark job fail với OutOfMemory

```
java.lang.OutOfMemoryError: Java heap space
```

**Fix**: Tăng Spark memory trong `docker-compose.yml`:
```yaml
spark-worker:
  environment:
    SPARK_WORKER_MEMORY: 4g  # Tăng từ 2g
```

### 7.4. Schema mismatch

```
Cannot parse JSON: field 'price' has type STRING but expected DOUBLE
```

**Fix**: Bật auto-merge trong Spark config:
```python
.config("spark.databricks.delta.schema.autoMerge.enabled", "true")
# Đã có sẵn trong script 13
```

### 7.5. Gold tables trống

**Fix**: Chờ ít nhất 5 phút (window size). Hoặc trigger manual:
```sql
-- Refresh Silver view
REFRESH TABLE delta.`s3a://silver/tiki/categories/`;

-- Kiểm tra Bronze
SELECT COUNT(*) FROM delta.`s3a://bronze/tiki/categories/`;
```

## 8. Use case thực tế

✅ **Real-time pricing**: Theo dõi giá cạnh tranh
✅ **Inventory management**: Phát hiện hot/cold products
✅ **Marketing**: Tìm category có discount nhiều nhất
✅ **Sales forecasting**: Dự đoán doanh thu từ order_count
✅ **Brand analytics**: So sánh brand nào bán chạy
✅ **Market share**: % doanh thu mỗi parent category

## 9. Kết luận

Hệ thống này cho phép:
- 🧵 **8 threads crawl** song song → tốc độ cao
- 📡 **Kafka** làm buffer → chịu tải tốt
- ⚡ **Spark Streaming** xử lý real-time
- 🥇 **4 Gold tables** cho BI dashboard
- 📊 **8 SQL queries** phân tích doanh số chi tiết
