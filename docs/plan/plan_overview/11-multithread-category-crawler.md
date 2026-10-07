
>  **Mục tiêu**: Setup hệ thống **crawler đa luồng** → **Kafka** → **Spark Streaming** → **Delta Lake Gold** để phân tích **doanh số real-time theo danh mục sản phẩm** từ Tiki.vn.

---


1. [Tổng quan kiến trúc](#1-tổng-quan)
2. [Cài đặt](#2-cài-đặt)
3. [Crawler đa luồng (script 12)](#3-crawler-đa-luồng)
4. [Spark Streaming xử lý (script 13)](#4-spark-streaming)
5. [Phân tích doanh số (SQL queries)](#5-phân-tích-doanh-số)
6. [Demo end-to-end](#6-demo)
7. [Troubleshooting](#7-troubleshooting)

---


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
│   │    revenue_by_category: doanh thu/category/5min    │      │
│   │    top_products_by_category: top 10 sp/category     │      │
│   │    parent_category_summary: tổng hợp               │      │
│   │    discount_analysis: phân tích giảm giá           │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                  │
│   BI: Metabase / Streamlit dashboard                            │
└──────────────────────────────────────────────────────────────────┘
```


- Docker (MinIO, Spark, Kafka đang chạy)
- Python 3.9+
- 8GB RAM trở lên

```bash
pip install requests kafka-python pyspark delta-spark
```

```bash
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list

docker exec lake-kafka kafka-topics \
  --bootstrap-server localhost:29092 \
  --create --topic tiki-category-stream \
  --partitions 3 --replication-factor 1
```

```bash
docker exec lake-minio mc mb -p local/bronze/tiki --ignore-existing
docker exec lake-minio mc mb -p local/silver/tiki --ignore-existing
docker exec lake-minio mc mb -p local/gold/category_analytics --ignore-existing
```



-  **28 categories** đầy đủ (Electronics, Fashion, Beauty, Home, Books, Sports, Mom & Baby)
-  **8 threads** chạy song song (configurable)
-  **Thread-safe Kafka producer** (với Lock + queue)
-  **Auto retry** khi 403/500
-  **File backup** (.jsonl.gz) phòng khi Kafka fail
-  **Stats tracking** real-time
-  **Rate limiting** thông minh


```bash
python scripts/12_multithread_category_crawler.py --workers 8 --pages 3

python scripts/12_multithread_category_crawler.py \
  --workers 4 --pages 5 \
  --groups electronics,fashion

python scripts/12_multithread_category_crawler.py \
  --categories smartphone,laptop,thoi-trang-nu \
  --workers 3 --pages 5
```


```
============================================================
  Multi-thread Tiki Category Crawler
   Workers: 8
   Pages/category: 3
   Categories: 28
   Kafka: localhost:9092
   Topic: tiki-category-stream
============================================================
 Connecting to Kafka...
 Kafka Producer connected: ['localhost:9092'], topic=tiki-category-stream
 Starting 8 threads for 28 categories...

   [smartphone] Start: Điện thoại Smartphone
   [laptop] Start: Laptop
   [thoi-trang-nu] Start: Thời trang nữ
   [my-pham] Start: Mỹ phẩm
  ...
   [smartphone] Page 2: 40 products (total: 80)
   [laptop] Page 2: 40 products (total: 80)
   [smartphone] Done: 120 products, 0 errors
   [laptop] Done: 120 products, 0 errors
  ...

============================================================
 CRAWL COMPLETED in 145.3s
   Total products: 3,360
   Categories: 28
   Parent categories: 6
   Throughput: 23.1 products/sec
============================================================

 TOP 10 categories theo số lượng:
   smartphone                     :   120 products
   laptop                         :   120 products
   thoi-trang-nu                  :   120 products
   my-pham                        :   120 products
   ...

 Doanh số (tổng products) theo parent category:
   electronics            :   720 products
   fashion                :   480 products
   beauty                 :   480 products
   home                   :   360 products
   books                  :   360 products
   sports                 :   120 products
   mom-baby               :   240 products
```


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
  "order_count": 5678,           //  Số lượng đã bán
  "favourite_count": 890,
  "category_key": "smartphone",  //  Dùng để partition
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



-  **Schema enforcement**: Đảm bảo data đúng format
-  **Data enrichment**: Tính `revenue_estimate`, `popularity_score`, `sales_tier`
-  **Watermark**: 30 phút (tránh late data)
-  **4 Gold tables**:
  1. `revenue_by_category`: Doanh thu/category/5min
  2. `top_products_by_category`: Top 10 sp/category
  3. `parent_category_summary`: Tổng hợp theo parent
  4. `discount_analysis`: Phân tích discount


```bash
python scripts/12_multithread_category_crawler.py

docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/13_category_revenue_streaming.py
```


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

```sql
SELECT
  category_name,
  top_10_products  -- Array of {product_id, name, order_count, revenue, price, ...}
FROM delta.`s3a://gold/category_analytics/top_products_by_category/`
ORDER BY window_start DESC;
```

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


```bash
docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "$(cat sql/04_category_revenue.sql | head -50)"

docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -f sql/04_category_revenue.sql
```



```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

docker ps
```


**Terminal 1: Crawler (sinh data)**
```bash
python scripts/12_multithread_category_crawler.py --workers 8 --pages 3
```

**Terminal 2: Spark Streaming (xử lý)**
```bash
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/13_category_revenue_streaming.py
```

**Terminal 3: Query real-time**
```bash
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



```
  [smartphone] Rate limited, sleeping 30s...
```

**Fix**: Tăng delay giữa các request:
```python
time.sleep(random.uniform(1.5, 2.5))  # Thay vì 0.5-1.0
```


```
 Kafka send failed: NoBrokersAvailable
```

**Fix**: Kiểm tra Kafka đang chạy:
```bash
docker ps | grep kafka
docker logs lake-kafka | tail -20
```


```
java.lang.OutOfMemoryError: Java heap space
```

**Fix**: Tăng Spark memory trong `docker-compose.yml`:
```yaml
spark-worker:
  environment:
    SPARK_WORKER_MEMORY: 4g  # Tăng từ 2g
```


```
Cannot parse JSON: field 'price' has type STRING but expected DOUBLE
```

**Fix**: Bật auto-merge trong Spark config:
```python
.config("spark.databricks.delta.schema.autoMerge.enabled", "true")
```


**Fix**: Chờ ít nhất 5 phút (window size). Hoặc trigger manual:
```sql
-- Refresh Silver view
REFRESH TABLE delta.`s3a://silver/tiki/categories/`;

-- Kiểm tra Bronze
SELECT COUNT(*) FROM delta.`s3a://bronze/tiki/categories/`;
```


 **Real-time pricing**: Theo dõi giá cạnh tranh
 **Inventory management**: Phát hiện hot/cold products
 **Marketing**: Tìm category có discount nhiều nhất
 **Sales forecasting**: Dự đoán doanh thu từ order_count
 **Brand analytics**: So sánh brand nào bán chạy
 **Market share**: % doanh thu mỗi parent category


Hệ thống này cho phép:
-  **8 threads crawl** song song → tốc độ cao
-  **Kafka** làm buffer → chịu tải tốt
-  **Spark Streaming** xử lý real-time
-  **4 Gold tables** cho BI dashboard
-  **8 SQL queries** phân tích doanh số chi tiết
