# ============================================================
# Batch job: Bronze → Silver → Gold
# ============================================================
"""
Đọc dữ liệu từ Bronze layer (Delta Lake), clean và tạo:
  - Silver: Cleaned, validated, deduplicated
  - Gold: Business metrics (aggregations)

Chạy:
  docker exec -it lake-spark-master spark-submit \
    --packages io.delta:delta-spark_2.12:3.0.0 \
    /scripts/demo/03_batch_etl.py
"""

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

# ============================================================
# Config
# ============================================================
BRONZE_PATH = "s3a://bronze/clickstream/events/"
SILVER_PATH = "s3a://silver/clickstream/events/"
GOLD_REVENUE_PATH  = "s3a://gold/clickstream/revenue_by_category/"
GOLD_USERS_PATH    = "s3a://gold/clickstream/active_users/"

# ============================================================
# Spark Session
# ============================================================
print("🚀 Creating Spark session...")
spark = (
    SparkSession.builder
    .appName("Bronze-to-Silver-to-Gold")
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
    .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000")
    .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
    .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
    .config("spark.hadoop.fs.s3a.path.style.access", "true")
    .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("WARN")
print(f"✅ Spark version: {spark.version}")

# ============================================================
# Step 1: Read Bronze layer
# ============================================================
print(f"\n🥉 Reading Bronze layer: {BRONZE_PATH}")
bronze_df = spark.read.format("delta").load(BRONZE_PATH)

print(f"📊 Bronze records: {bronze_df.count()}")
bronze_df.printSchema()

# ============================================================
# Step 2: Clean → Silver layer
# ============================================================
print(f"\n🥈 Cleaning → Silver layer...")

silver_df = (
    bronze_df
    # Remove nulls
    .filter(F.col("event_id").isNotNull())
    .filter(F.col("user_id").isNotNull())
    .filter(F.col("event_type").isNotNull())

    # Validate event types
    .filter(F.col("event_type").isin([
        "page_view", "click", "add_to_cart", "purchase", "search"
    ]))

    # Validate amounts (chỉ purchase mới có amount)
    .withColumn(
        "amount",
        F.when(F.col("event_type") == "purchase",
               F.when(F.col("amount") > 0, F.col("amount")).otherwise(0.0))
        .otherwise(0.0)
    )

    # Parse timestamp
    .withColumn("event_timestamp", F.to_timestamp(F.col("timestamp")))

    # Add derived features
    .withColumn("event_hour", F.hour(F.col("event_timestamp")))
    .withColumn("event_date", F.date_format(F.col("event_timestamp"), "yyyy-MM-dd"))

    # Remove duplicates
    .dropDuplicates(["event_id"])
)

# Write Silver
print(f"💾 Writing Silver layer: {SILVER_PATH}")
(silver_df.write
    .format("delta")
    .mode("overwrite")
    .partitionBy("event_date")
    .save(SILVER_PATH))

print(f"✅ Silver records: {silver_df.count()}")

# ============================================================
# Step 3: Gold Layer - Revenue by category
# ============================================================
print(f"\n🥇 Gold Layer 1: Revenue by category...")

revenue_by_category = (
    silver_df
    .filter(F.col("event_type") == "purchase")
    .groupBy("category")
    .agg(
        F.count("*").alias("num_purchases"),
        F.sum("amount").alias("total_revenue"),
        F.avg("amount").alias("avg_order_value"),
        F.countDistinct("user_id").alias("unique_buyers"),
    )
    .withColumn("updated_at", F.current_timestamp())
    .orderBy(F.desc("total_revenue"))
)

print(f"💾 Writing Gold: {GOLD_REVENUE_PATH}")
(revenue_by_category.write
    .format("delta")
    .mode("overwrite")
    .save(GOLD_REVENUE_PATH))

revenue_by_category.show(truncate=False)

# ============================================================
# Step 4: Gold Layer - Active users
# ============================================================
print(f"\n🥇 Gold Layer 2: Active users by hour...")

active_users = (
    silver_df
    .groupBy("event_date", "event_hour")
    .agg(
        F.countDistinct("user_id").alias("active_users"),
        F.countDistinct("session_id").alias("active_sessions"),
        F.count("*").alias("total_events"),
    )
    .withColumn("updated_at", F.current_timestamp())
    .orderBy("event_date", "event_hour")
)

print(f"💾 Writing Gold: {GOLD_USERS_PATH}")
(active_users.write
    .format("delta")
    .mode("overwrite")
    .partitionBy("event_date")
    .save(GOLD_USERS_PATH))

active_users.show(20, truncate=False)

# ============================================================
# Step 5: Gold Layer - Top products
# ============================================================
print(f"\n🥇 Gold Layer 3: Top products...")

top_products_path = "s3a://gold/clickstream/top_products/"

top_products = (
    silver_df
    .filter(F.col("product_id").isNotNull())
    .groupBy("product_id", "category")
    .agg(
        F.count("*").alias("total_events"),
        F.sum(F.when(F.col("event_type") == "purchase", 1).otherwise(0)).alias("purchases"),
        F.sum(F.when(F.col("event_type") == "add_to_cart", 1).otherwise(0)).alias("add_to_carts"),
    )
    .withColumn("conversion_rate",
                F.round(F.col("purchases") / F.col("total_events") * 100, 2))
    .withColumn("updated_at", F.current_timestamp())
    .orderBy(F.desc("purchases"))
    .limit(100)
)

print(f"💾 Writing Gold: {top_products_path}")
(top_products.write
    .format("delta")
    .mode("overwrite")
    .save(top_products_path))

top_products.show(20, truncate=False)

print(f"\n{'='*60}")
print(f"✅ ETL hoàn tất!")
print(f"{'='*60}")
print(f"\n📊 Tổng kết:")
print(f"   🥉 Bronze: {bronze_df.count()} records")
print(f"   🥈 Silver: {silver_df.count()} records")
print(f"   🥇 Gold Revenue: {revenue_by_category.count()} categories")
print(f"   🥇 Gold Users: {active_users.count()} hour-buckets")
print(f"   🥇 Gold Products: {top_products.count()} top products")
print(f"\n🌐 Xem data:")
print(f"   - MinIO Console: http://localhost:9001")
print(f"   - Metabase:      http://localhost:3000")
print(f"   - Spark UI:      http://localhost:8080")