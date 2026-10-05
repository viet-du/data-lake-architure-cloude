"""
Spark Streaming: E-commerce data từ Kafka → Delta Lake
Xử lý data từ 3 nguồn:
  - ecommerce-products-stream (Tiki crawler)
  - ecommerce-reviews-stream (Tiki reviews)
  - ecommerce-price-stream (Tiki price monitoring)

Pipeline:
  Kafka → Bronze (raw) → Silver (cleaned, normalized) → Gold (aggregated)

Chạy:
  docker exec lake-spark-master spark-submit \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
    /scripts/11_ecommerce_streaming.py
"""
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, FloatType, IntegerType,
    LongType, DoubleType, TimestampType, ArrayType
)
from delta import configure_spark_with_delta_pip
import os


# ============ Configuration ============
ENV = os.getenv("ENV", "local")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")

if ENV == "local":
    BRONZE_PATH = "s3a://bronze/ecommerce/"
    SILVER_PATH = "s3a://silver/ecommerce/"
    GOLD_PATH = "s3a://gold/ecommerce/"
    CHECKPOINT_BASE = "s3a://bronze/ecommerce/_checkpoints/"
elif ENV == "gcp":
    BRONZE_PATH = "gs://datalake-architecture-bronze/ecommerce/"
    SILVER_PATH = "gs://datalake-architecture-silver/ecommerce/"
    GOLD_PATH = "gs://datalake-architecture-gold/ecommerce/"
    CHECKPOINT_BASE = "gs://datalake-architecture-bronze/ecommerce/_checkpoints/"

# Topics
TOPICS = {
    "products": "ecommerce-products-stream",
    "reviews": "ecommerce-reviews-stream",
    "prices": "ecommerce-price-stream",
}


# ============ Schemas ============
PRODUCT_SCHEMA = StructType([
    StructField("id", LongType(), True),
    StructField("name", StringType(), True),
    StructField("sku", StringType(), True),
    StructField("url_key", StringType(), True),
    StructField("price", DoubleType(), True),
    StructField("original_price", DoubleType(), True),
    StructField("discount", DoubleType(), True),
    StructField("discount_rate", DoubleType(), True),
    StructField("rating_average", DoubleType(), True),
    StructField("review_count", IntegerType(), True),
    StructField("order_count", IntegerType(), True),
    StructField("favourite_count", IntegerType(), True),
    StructField("thumbnail_url", StringType(), True),
    StructField("brand_name", StringType(), True),
    StructField("seller_id", LongType(), True),
    StructField("seller_name", StringType(), True),
    StructField("category_key", StringType(), True),
    StructField("category_name", StringType(), True),
    StructField("category_id", IntegerType(), True),
    StructField("search_keyword", StringType(), True),
    StructField("_event_type", StringType(), True),
    StructField("_crawl_timestamp", StringType(), True),
    StructField("_source", StringType(), True),
    StructField("_kafka_topic", StringType(), True),
])

REVIEW_SCHEMA = StructType([
    StructField("id", LongType(), True),
    StructField("product_id", LongType(), True),
    StructField("title", StringType(), True),
    StructField("content", StringType(), True),
    StructField("rating", IntegerType(), True),
    StructField("created_by", StringType(), True),
    StructField("created_at", StringType(), True),
    StructField("thank_count", IntegerType(), True),
    StructField("_event_type", StringType(), True),
    StructField("_crawl_timestamp", StringType(), True),
])

PRICE_SCHEMA = StructType([
    StructField("product_id", LongType(), True),
    StructField("product_name", StringType(), True),
    StructField("price", DoubleType(), True),
    StructField("original_price", DoubleType(), True),
    StructField("discount", DoubleType(), True),
    StructField("discount_rate", DoubleType(), True),
    StructField("stock_quantity", IntegerType(), True),
    StructField("seller_id", LongType(), True),
    StructField("seller_name", StringType(), True),
    StructField("_event_type", StringType(), True),
    StructField("_crawl_timestamp", StringType(), True),
    StructField("_iteration", IntegerType(), True),
])


# ============ Spark Session ============
def create_spark():
    builder = (
        SparkSession.builder
        .appName("EcommerceStreaming")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0")
        .config("spark.sql.streaming.schemaInference", "true")
    )
    return configure_spark_with_delta_pip(builder).getOrCreate()


# ============ Bronze Layer (Raw) ============
def read_kafka_topic(spark, topic: str, schema: StructType):
    """Đọc 1 topic từ Kafka, parse JSON, return DataFrame streaming."""
    return (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", topic)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .option("maxOffsetsPerTrigger", 5000)
        .load()
        .select(
            F.col("key").cast("string").alias("kafka_key"),
            F.col("offset").alias("kafka_offset"),
            F.col("partition").alias("kafka_partition"),
            F.col("timestamp").alias("kafka_timestamp"),
            F.from_json(F.col("value").cast("string"), schema).alias("data"),
        )
        .select("kafka_key", "kafka_offset", "kafka_partition", "kafka_timestamp", "data.*")
    )


def write_bronze(df, name: str):
    """Ghi DataFrame streaming vào Delta Lake Bronze."""
    enriched = (
        df
        .withColumn("_processing_timestamp", F.current_timestamp())
        .withColumn("_ingestion_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
    )

    return (
        enriched.writeStream
        .format("delta")
        .outputMode("append")
        .partitionBy("_ingestion_date")
        .option("checkpointLocation", f"{CHECKPOINT_BASE}{name}")
        .option("path", f"{BRONZE_PATH}{name}/")
        .trigger(availableNow=True)
        .start()
    )


# ============ Silver Layer (Cleaned) ============
def process_products_silver(spark):
    """Đọc Bronze products → Silver."""
    bronze = (
        spark.readStream
        .format("delta")
        .option("ignoreChanges", "true")
        .load(f"{BRONZE_PATH}products/")
    )

    silver = (
        bronze
        .filter(F.col("id").isNotNull())
        .filter(F.col("price") > 0)
        # Normalize
        .withColumn("product_name", F.trim(F.col("name")))
        .withColumn("brand_name", F.initcap(F.col("brand_name")))
        # Cast types
        .withColumn("rating_average", F.round(F.col("rating_average"), 2))
        .withColumn("discount_rate_pct", F.round(F.col("discount_rate"), 2))
        # Derived fields
        .withColumn(
            "discount_amount",
            F.col("original_price") - F.col("price"),
        )
        .withColumn(
            "is_on_sale",
            F.when(F.col("discount_rate") > 0, True).otherwise(False),
        )
        .withColumn(
            "popularity_score",
            F.col("review_count") * 0.4 + F.col("order_count") * 0.5 + F.col("rating_average") * 100 * 0.1,
        )
        # Add price tier
        .withColumn(
            "price_tier",
            F.when(F.col("price") < 500000, "cheap")         # < 500k VND
            .when(F.col("price") < 2000000, "affordable")    # < 2M VND
            .when(F.col("price") < 10000000, "mid_range")    # < 10M VND
            .when(F.col("price") < 30000000, "premium")      # < 30M VND
            .otherwise("luxury"),
        )
        # Watermark
        .withWatermark("_crawl_timestamp", "10 minutes")
        # Dedup theo id (lấy bản mới nhất)
        .dropDuplicates(["id"])
        # Add partition
        .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
    )

    return (
        silver.writeStream
        .format("delta")
        .outputMode("append")
        .partitionBy("processing_date")
        .option("checkpointLocation", f"{SILVER_PATH}products/_checkpoints/")
        .option("path", f"{SILVER_PATH}products/")
        .trigger(availableNow=True)
        .start()
    )


def process_reviews_silver(spark):
    """Reviews Silver: clean text, validate rating."""
    bronze = (
        spark.readStream
        .format("delta")
        .option("ignoreChanges", "true")
        .load(f"{BRONZE_PATH}reviews/")
    )

    silver = (
        bronze
        .filter(F.col("product_id").isNotNull())
        .filter(F.col("rating").between(1, 5))
        .withColumn("title", F.trim(F.col("title")))
        .withColumn("content", F.trim(F.col("content")))
        .withColumn("content_length", F.length(F.col("content")))
        .withColumn(
            "sentiment",
            F.when(F.col("rating") >= 4, "positive")
            .when(F.col("rating") == 3, "neutral")
            .otherwise("negative"),
        )
        .withColumn("review_date", F.to_date("created_at"))
        .dropDuplicates(["id"])
    )

    return (
        silver.writeStream
        .format("delta")
        .outputMode("append")
        .partitionBy("review_date")
        .option("checkpointLocation", f"{SILVER_PATH}reviews/_checkpoints/")
        .option("path", f"{SILVER_PATH}reviews/")
        .trigger(availableNow=True)
        .start()
    )


# ============ Gold Layer (Aggregated) ============
def process_gold_real_time_metrics(spark):
    """Real-time metrics từ Silver layer."""
    products_silver = (
        spark.readStream
        .format("delta")
        .load(f"{SILVER_PATH}products/")
    )

    # Metric 1: Top products per category theo popularity
    top_products = (
        products_silver
        .withWatermark("_crawl_timestamp", "10 minutes")
        .groupBy(
            F.window(F.col("_crawl_timestamp"), "5 minutes"),
            F.col("category_name"),
        )
        .agg(
            F.count("*").alias("product_count"),
            F.avg("price").alias("avg_price"),
            F.avg("rating_average").alias("avg_rating"),
            F.sum("order_count").alias("total_orders"),
            F.max("price").alias("max_price"),
            F.min("price").alias("min_price"),
        )
    )

    # Metric 2: Price statistics by price_tier
    price_tier_stats = (
        products_silver
        .withWatermark("_crawl_timestamp", "10 minutes")
        .groupBy(
            F.window(F.col("_crawl_timestamp"), "5 minutes"),
            F.col("price_tier"),
        )
        .agg(
            F.count("*").alias("product_count"),
            F.avg("price").alias("avg_price"),
            F.avg("discount_rate_pct").alias("avg_discount"),
        )
    )

    # Metric 3: Top sellers
    top_sellers = (
        products_silver
        .withWatermark("_crawl_timestamp", "10 minutes")
        .groupBy(
            F.window(F.col("_crawl_timestamp"), "5 minutes"),
            F.col("seller_name"),
        )
        .agg(
            F.count("*").alias("product_count"),
            F.sum(F.col("order_count")).alias("total_orders"),
            F.avg("rating_average").alias("avg_rating"),
        )
    )

    # Write mỗi metric vào table riêng
    queries = []

    for name, df in [
        ("category_metrics", top_products),
        ("price_tier_metrics", price_tier_stats),
        ("seller_metrics", top_sellers),
    ]:
        query = (
            df.writeStream
            .format("delta")
            .outputMode("append")
            .option("checkpointLocation", f"{GOLD_PATH}{name}/_checkpoints/")
            .option("path", f"{GOLD_PATH}{name}/")
            .trigger(availableNow=True)
            .start()
        )
        queries.append(query)

    return queries


# ============ Main ============
def main():
    spark = create_spark()

    print("=" * 60)
    print("🛒 E-commerce Streaming Pipeline")
    print(f"   Kafka: {KAFKA_BOOTSTRAP}")
    print(f"   Topics: {list(TOPICS.values())}")
    print(f"   Bronze: {BRONZE_PATH}")
    print(f"   Silver: {SILVER_PATH}")
    print(f"   Gold:   {GOLD_PATH}")
    print("=" * 60)

    queries = []

    # 1. Bronze: Read từ 3 Kafka topics
    print("\n📥 BRONZE: Reading from Kafka topics...")

    products_stream = read_kafka_topic(spark, TOPICS["products"], PRODUCT_SCHEMA)
    reviews_stream = read_kafka_topic(spark, TOPICS["reviews"], REVIEW_SCHEMA)
    prices_stream = read_kafka_topic(spark, TOPICS["prices"], PRICE_SCHEMA)

    queries.append(write_bronze(products_stream, "products"))
    queries.append(write_bronze(reviews_stream, "reviews"))
    queries.append(write_bronze(prices_stream, "prices"))

    # 2. Silver
    print("\n🥈 SILVER: Cleaning & validating...")
    queries.append(process_products_silver(spark))
    queries.append(process_reviews_silver(spark))

    # 3. Gold
    print("\n🥇 GOLD: Real-time metrics...")
    gold_queries = process_gold_real_time_metrics(spark)
    queries.extend(gold_queries)

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
