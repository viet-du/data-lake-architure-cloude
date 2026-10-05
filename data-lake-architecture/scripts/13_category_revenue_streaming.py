"""
Spark Streaming: Phân tích doanh số theo danh mục real-time
Đọc từ Kafka topic `tiki-category-stream`, tính toán:
  - Doanh thu theo category
  - Top sản phẩm bán chạy theo category
  - Phân tích discount, rating
  - So sánh doanh số các parent categories

Output:
  - Gold layer: s3a://gold/category_analytics/
    - revenue_by_category (5-min window)
    - top_products_by_category
    - parent_category_summary
    - discount_analysis

Chạy:
  docker exec lake-spark-master spark-submit \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
    /scripts/13_category_revenue_streaming.py
"""
import os
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, LongType, BooleanType
)
from delta import configure_spark_with_delta_pip

# ============ Configuration ============
ENV = os.getenv("ENV", "local")

if ENV == "local":
    BRONZE_PATH = "s3a://bronze/tiki/categories/"
    SILVER_PATH = "s3a://silver/tiki/categories/"
    GOLD_PATH = "s3a://gold/category_analytics/"
    CHECKPOINT_BASE = "s3a://bronze/tiki/categories/_checkpoints/"
elif ENV == "gcp":
    BRONZE_PATH = "gs://datalake-architecture-bronze/tiki/categories/"
    SILVER_PATH = "gs://datalake-architecture-silver/tiki/categories/"
    GOLD_PATH = "gs://datalake-architecture-gold/category_analytics/"
    CHECKPOINT_BASE = "gs://datalake-architecture-bronze/tiki/categories/_checkpoints/"

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:29092")
KAFKA_TOPIC = "tiki-category-stream"


# ============ Schema ============
PRODUCT_SCHEMA = StructType([
    StructField("id", LongType(), True),
    StructField("name", StringType(), True),
    StructField("sku", StringType(), True),
    StructField("url_key", StringType(), True),

    # Price
    StructField("price", DoubleType(), True),
    StructField("original_price", DoubleType(), True),
    StructField("discount", DoubleType(), True),
    StructField("discount_rate", DoubleType(), True),

    # Sales
    StructField("rating_average", DoubleType(), True),
    StructField("review_count", IntegerType(), True),
    StructField("order_count", IntegerType(), True),  # Số lượng đã bán
    StructField("favourite_count", IntegerType(), True),

    # Category
    StructField("category_key", StringType(), True),
    StructField("category_name", StringType(), True),
    StructField("category_id", LongType(), True),
    StructField("parent_category", StringType(), True),

    # Brand/Seller
    StructField("brand_name", StringType(), True),
    StructField("seller_id", LongType(), True),
    StructField("seller_name", StringType(), True),

    # Other
    StructField("thumbnail_url", StringType(), True),
    StructField("is_authentic", BooleanType(), True),
    StructField("is_visible", BooleanType(), True),

    # Crawl metadata
    StructField("_crawl_id", StringType(), True),
    StructField("_crawl_timestamp", StringType(), True),
    StructField("_crawl_date", StringType(), True),
    StructField("_source", StringType(), True),
    StructField("_thread", StringType(), True),
])


# ============ Spark Session ============
def create_spark():
    builder = (
        SparkSession.builder
        .appName("CategoryRevenueStreaming")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.sql.streaming.checkpointLocation.deleteRetainedAfterDuration", "7d")
    )
    return configure_spark_with_delta_pip(builder).getOrCreate()


# ============ Bronze Layer ============
def read_from_kafka(spark):
    """Đọc stream từ Kafka topic."""
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .option("maxOffsetsPerTrigger", 5000)
        .load()
        .select(
            F.col("key").cast("string").alias("kafka_key"),
            F.col("offset").alias("kafka_offset"),
            F.col("partition").alias("kafka_partition"),
            F.col("timestamp").alias("kafka_timestamp"),
            F.from_json(F.col("value").cast("string"), PRODUCT_SCHEMA).alias("data"),
        )
        .select("kafka_key", "kafka_offset", "kafka_partition", "kafka_timestamp", "data.*")
    )


def write_bronze(df):
    """Ghi Bronze - raw data."""
    enriched = (
        df
        .withColumn("_processing_timestamp", F.current_timestamp())
        .withColumn("_processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
    )
    return (
        enriched.writeStream
        .format("delta")
        .outputMode("append")
        .partitionBy("_processing_date")
        .option("checkpointLocation", f"{CHECKPOINT_BASE}bronze")
        .option("path", f"{BRONZE_PATH}")
        .trigger(availableNow=True)
        .start()
    )


# ============ Silver Layer ============
def process_silver(spark):
    """Bronze → Silver: clean, validate, enrich."""

    # Read Bronze
    bronze = (
        spark.readStream
        .format("delta")
        .option("ignoreChanges", "true")
        .load(BRONZE_PATH)
    )

    silver = (
        bronze
        # Validate
        .filter(F.col("id").isNotNull())
        .filter(F.col("category_key").isNotNull())
        .filter(F.col("price") > 0)

        # Clean
        .withColumn("product_name", F.trim(F.col("name")))
        .withColumn("category_name", F.trim(F.col("category_name")))

        # Derived fields cho phân tích doanh số
        .withColumn("revenue_estimate", F.col("price") * F.col("order_count"))  # Doanh thu ước tính
        .withColumn("discount_amount", F.col("original_price") - F.col("price"))
        .withColumn("is_on_sale", F.when(F.col("discount_rate") > 0, True).otherwise(False))
        .withColumn("discount_tier",
                    F.when(F.col("discount_rate") < 10, "low")
                    .when(F.col("discount_rate") < 30, "medium")
                    .otherwise("high"))

        # Price tier
        .withColumn("price_tier",
                    F.when(F.col("price") < 100000, "budget")
                    .when(F.col("price") < 500000, "affordable")
                    .when(F.col("price") < 2000000, "mid_range")
                    .when(F.col("price") < 10000000, "premium")
                    .otherwise("luxury"))

        # Sales tier
        .withColumn("sales_tier",
                    F.when(F.col("order_count") < 10, "cold")
                    .when(F.col("order_count") < 100, "warm")
                    .when(F.col("order_count") < 1000, "hot")
                    .otherwise("bestseller"))

        # Popularity score
        .withColumn("popularity_score",
                    F.col("order_count") * 0.5
                    + F.col("review_count") * 0.3
                    + F.col("rating_average") * F.col("review_count") * 0.2)

        # Timestamp
        .withColumn("crawl_timestamp", F.to_timestamp("_crawl_timestamp"))
        .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))

        # Dedup
        .dropDuplicates(["id", "_crawl_date"])
    )

    return (
        silver.writeStream
        .format("delta")
        .outputMode("append")
        .partitionBy("processing_date", "parent_category")
        .option("checkpointLocation", f"{SILVER_PATH}_checkpoints/")
        .option("path", SILVER_PATH)
        .trigger(availableNow=True)
        .start()
    )


# ============ Gold Layer: Phân tích doanh số ============
def build_revenue_by_category(spark):
    """Doanh thu theo category (5-min window)."""
    silver = (
        spark.readStream
        .format("delta")
        .load(SILVER_PATH)
        .withWatermark("crawl_timestamp", "30 minutes")
    )

    revenue = (
        silver
        .groupBy(
            F.window(F.col("crawl_timestamp"), "5 minutes", "1 minute"),
            F.col("category_key"),
            F.col("category_name"),
            F.col("parent_category"),
        )
        .agg(
            F.count("*").alias("product_count"),
            F.countDistinct("id").alias("unique_products"),
            F.sum("order_count").alias("total_units_sold"),
            F.sum("revenue_estimate").alias("total_revenue_estimate"),
            F.avg("price").alias("avg_price"),
            F.avg("rating_average").alias("avg_rating"),
            F.avg("discount_rate").alias("avg_discount_rate"),
            F.max("price").alias("max_price"),
            F.min("price").alias("min_price"),
        )
        .withColumn("window_start", F.col("window.start"))
        .withColumn("window_end", F.col("window.end"))
        .drop("window")
    )

    return (
        revenue.writeStream
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", f"{GOLD_PATH}revenue_by_category/_checkpoints/")
        .option("path", f"{GOLD_PATH}revenue_by_category/")
        .trigger(availableNow=True)
        .start()
    )


def build_top_products_by_category(spark):
    """Top products bán chạy theo category (5-min window)."""
    silver = (
        spark.readStream
        .format("delta")
        .load(SILVER_PATH)
        .withWatermark("crawl_timestamp", "30 minutes")
    )

    # Top 10 products per category per window
    top_products = (
        silver
        .groupBy(
            F.window(F.col("crawl_timestamp"), "5 minutes", "1 minute"),
            F.col("category_key"),
            F.col("category_name"),
        )
        .agg(
            F.collect_list(
                F.struct(
                    F.col("id").alias("product_id"),
                    F.col("product_name"),
                    F.col("order_count"),
                    F.col("revenue_estimate"),
                    F.col("price"),
                    F.col("rating_average"),
                    F.col("discount_rate"),
                )
            ).alias("products")
        )
        .select(
            F.col("window.start").alias("window_start"),
            "category_key",
            "category_name",
            F.expr("slice(products, 1, 10)").alias("top_10_products")
        )
    )

    return (
        top_products.writeStream
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", f"{GOLD_PATH}top_products_by_category/_checkpoints/")
        .option("path", f"{GOLD_PATH}top_products_by_category/")
        .trigger(availableNow=True)
        .start()
    )


def build_parent_category_summary(spark):
    """Tổng hợp theo parent category."""
    silver = (
        spark.readStream
        .format("delta")
        .load(SILVER_PATH)
        .withWatermark("crawl_timestamp", "30 minutes")
    )

    parent_summary = (
        silver
        .groupBy(
            F.window(F.col("crawl_timestamp"), "5 minutes", "5 minutes"),
            F.col("parent_category"),
        )
        .agg(
            F.countDistinct("id").alias("total_products"),
            F.countDistinct("category_key").alias("num_subcategories"),
            F.sum("order_count").alias("total_units_sold"),
            F.sum("revenue_estimate").alias("total_revenue"),
            F.avg("price").alias("avg_price"),
            F.avg("rating_average").alias("avg_rating"),
            F.countDistinct("brand_name").alias("num_brands"),
        )
        .withColumn("window_start", F.col("window.start"))
        .withColumn("window_end", F.col("window.end"))
        .drop("window")
    )

    return (
        parent_summary.writeStream
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", f"{GOLD_PATH}parent_category_summary/_checkpoints/")
        .option("path", f"{GOLD_PATH}parent_category_summary/")
        .trigger(availableNow=True)
        .start()
    )


def build_discount_analysis(spark):
    """Phân tích discount theo category."""
    silver = (
        spark.readStream
        .format("delta")
        .load(SILVER_PATH)
        .withWatermark("crawl_timestamp", "30 minutes")
    )

    discount = (
        silver
        .groupBy(
            F.window(F.col("crawl_timestamp"), "5 minutes", "5 minutes"),
            F.col("category_key"),
            F.col("discount_tier"),
        )
        .agg(
            F.count("*").alias("product_count"),
            F.avg("price").alias("avg_price"),
            F.avg("original_price").alias("avg_original_price"),
            F.sum("discount_amount").alias("total_discount_value"),
            F.avg("order_count").alias("avg_units_sold"),
        )
        .withColumn("window_start", F.col("window.start"))
        .withColumn("window_end", F.col("window.end"))
        .drop("window")
    )

    return (
        discount.writeStream
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", f"{GOLD_PATH}discount_analysis/_checkpoints/")
        .option("path", f"{GOLD_PATH}discount_analysis/")
        .trigger(availableNow=True)
        .start()
    )


# ============ Main ============
def main():
    spark = create_spark()
    spark.sparkContext.setLogLevel("WARN")

    print("=" * 60)
    print("📊 CATEGORY REVENUE STREAMING")
    print(f"   Kafka: {KAFKA_BOOTSTRAP}, Topic: {KAFKA_TOPIC}")
    print(f"   Bronze: {BRONZE_PATH}")
    print(f"   Silver: {SILVER_PATH}")
    print(f"   Gold:   {GOLD_PATH}")
    print("=" * 60)

    queries = []

    # 1. Bronze
    print("\n🥉 BRONZE: Reading from Kafka...")
    raw_stream = read_from_kafka(spark)
    queries.append(write_bronze(raw_stream))

    # 2. Silver
    print("\n🥈 SILVER: Cleaning & enriching...")
    queries.append(process_silver(spark))

    # 3. Gold - 4 metrics
    print("\n🥇 GOLD: Phân tích doanh số...")

    print("   1️⃣  Revenue by category...")
    queries.append(build_revenue_by_category(spark))

    print("   2️⃣  Top products by category...")
    queries.append(build_top_products_by_category(spark))

    print("   3️⃣  Parent category summary...")
    queries.append(build_parent_category_summary(spark))

    print("   4️⃣  Discount analysis...")
    queries.append(build_discount_analysis(spark))

    print(f"\n✅ Started {len(queries)} streaming queries")
    print("   Press Ctrl+C to stop...")

    try:
        spark.streams.awaitAnyTermination()
    except KeyboardInterrupt:
        print("\n⏸️  Stopping all streams...")
        for q in queries:
            q.stop()
        print("✅ Stopped")


if __name__ == "__main__":
    main()
