

**Medallion Architecture** (còn gọi là **Multi-hop Architecture**) là mẫu thiết kế data lake do **Databricks** đề xuất, tổ chức dữ liệu thành **3 layer tuần tự**:

```
┌────────────┐      ┌────────────┐      ┌────────────┐
│   BRONZE   │ ───▶ │   SILVER   │ ───▶ │    GOLD    │
│   (Raw)    │      │ (Cleaned)  │      │ (Curated)  │
└────────────┘      └────────────┘      └────────────┘
  Append-only        Conformed           Aggregated
  No transform       Quality checked    Business logic
```

Mỗi layer có **mục đích, định dạng, và cách xử lý** khác nhau.


Lưu trữ dữ liệu **nguyên bản** từ nguồn, **không biến đổi gì**. "Single source of truth" của dữ liệu thô.


| Đặc điểm | Mô tả |
|----------|-------|
| Tính chất | Append-only (chỉ thêm) |
| Schema | Không enforce (giữ nguyên schema nguồn) |
| Format | JSON, CSV, Parquet (theo nguồn) |
| Partition | Theo `ingestion_date` (YYYY-MM-DD) |
| Retention | Lâu dài (vài năm) |
| Consumer | Data Engineer, Data Scientist, Audit |


```
s3a://bronze/
├── crm/
│   └── customers/
│       ├── ingestion_date=2024-10-01/
│       │   ├── part-0000.json
│       │   └── part-0001.json
│       └── ingestion_date=2024-10-02/
├── erp/
│   ├── orders/
│   └── products/
└── iot/
    └── sensors/
```


```python
import csv
from pyspark.sql import SparkSession
from delta import configure_spark_with_delta_pip

spark = configure_spark_with_delta_pip(
    SparkSession.builder.appName("BronzeIngest")
).getOrCreate()

df = spark.read.csv("data-samples/customers.csv", header=True, inferSchema=True)

df = df.withColumn("_ingestion_timestamp", current_timestamp()) \
       .withColumn("_ingestion_date", date_format(current_timestamp(), "yyyy-MM-dd")) \
       .withColumn("_source_file", lit("customers.csv")) \
       .withColumn("_source_system", lit("crm_db"))

df.write.format("delta") \
  .mode("append") \
  .partitionBy("_ingestion_date") \
  .save("s3a://bronze/crm/customers/")
```


Làm sạch, validate, chuẩn hóa dữ liệu từ Bronze. Có thể join các nguồn với nhau.


| Đặc điểm | Mô tả |
|----------|-------|
| Tính chất | Cleaned, validated, conformed |
| Schema | Enforced (chuẩn hóa) |
| Format | Delta Lake (Parquet + Transaction log) |
| Partition | Theo business date (order_date, event_date...) |
| Retention | Trung bình (1-2 năm) |
| Consumer | Data Analyst, Data Scientist |


```python
from pyspark.sql import functions as F

df_bronze = spark.read.format("delta").load("s3a://bronze/crm/customers/")

df_silver = (
    df_bronze
    .filter(F.col("customer_id").isNotNull())
    .filter(F.col("email").contains("@"))
    .filter((F.col("age") >= 0) & (F.col("age") <= 120))

    .withColumn("email", F.lower(F.trim(F.col("email"))))
    .withColumn("full_name", F.trim(F.concat_ws(" ", "first_name", "last_name")))

    .withColumn("age_group",
                F.when(F.col("age") < 25, "young")
                .when(F.col("age") < 50, "middle")
                .otherwise("senior"))

    .dropDuplicates(["customer_id"])

    .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
)

df_silver.write.format("delta") \
  .mode("overwrite") \
  .partitionBy("processing_date") \
  .save("s3a://silver/customers/")
```


Dữ liệu đã được **business logic** xử lý, sẵn sàng cho BI/ML.


| Đặc điểm | Mô tả |
|----------|-------|
| Tính chất | Aggregated, business KPIs |
| Schema | Star schema (fact + dim) |
| Format | Delta Lake |
| Partition | Theo date |
| Retention | Ngắn (vài tháng) |
| Consumer | Business, BI tools |


```python
fact = (
    orders
    .join(customers, "customer_id", "left")
    .join(products, "product_id", "left")
    .withColumn("revenue", F.col("line_total"))
    .withColumn("profit", F.col("revenue") * 0.4)
    .select(
        "order_id", "order_date", "customer_id", "full_name", "city",
        "product_id", "product_name", "category",
        "quantity", "unit_price", "revenue", "profit", "status",
    )
)
fact.write.format("delta").mode("overwrite").partitionBy("order_date").save("s3a://gold/fact_orders/")

dim = (
    customers.join(orders_metrics, "customer_id", "left")
    .withColumn("customer_segment_value",
                F.when(F.col("lifetime_revenue") > 5000, "VIP")
                .when(F.col("lifetime_revenue") > 1000, "Gold")
                .otherwise("Silver"))
)
dim.write.format("delta").mode("overwrite").save("s3a://gold/dim_customers/")
```


| Layer | Bronze | Silver | Gold |
|-------|--------|--------|------|
| **Audience** | Engineer | Analyst | Business |
| **Schema** | Loose | Enforced | Optimized |
| **Quality** | Raw | Cleaned | Curated |
| **Size** | Largest | Medium | Smallest |
| **Query** | Slow (full scan) | Medium | Fast (aggregated) |
| **Cost** | Cheap | Medium | Medium |


 **Traceability**: Từ Gold → Silver → Bronze để debug
 **Reprocessing**: Fix logic ở Silver/Gold, không cần re-ingest
 **Multiple use case**: Mỗi layer phục vụ 1 nhóm user
 **Data Quality**: Validate ở mỗi bước
 **Performance**: Mỗi layer tối ưu cho use case riêng


-  Skip Bronze (không có audit trail)
-  Logic business ở Bronze (làm Silver thừa)
-  Query trực tiếp Bronze (chậm, tốn tiền)
-  Quá nhiều layer (4-5+) - phức tạp không cần thiết
-  Không partition (full scan toàn bộ data)
