#!/usr/bin/env python3
"""
Script 02: Transform Bronze → Silver
Clean, validate, conform data.

Chạy:
  docker exec lake-spark-master spark-submit \
    --packages io.delta:delta-spark_2.12:3.0.0 \
    /scripts/02_transform_to_silver.py
"""
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from delta import configure_spark_with_delta_pip


def create_spark():
    builder = (
        SparkSession.builder
        .appName("02_TransformToSilver")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.schema.autoMerge.enabled", "true")
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000")
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin")
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
    )
    return configure_spark_with_delta_pip(builder).getOrCreate()


def transform_customers(spark):
    """Bronze customers → Silver (clean & validate)."""
    print("\n🥈 Transform: customers")
    bronze = spark.read.format("delta").load("s3a://bronze/crm/customers/")

    silver = (
        bronze
        .filter(F.col("customer_id").isNotNull())
        .filter(F.col("email").contains("@"))  # Validate email
        .filter((F.col("age") >= 0) & (F.col("age") <= 120))
        .withColumn("email", F.lower(F.trim(F.col("email"))))
        .withColumn("full_name", F.trim(F.concat_ws(" ", F.col("first_name"), F.col("last_name"))))
        .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
        .dropDuplicates(["customer_id"])
    )

    silver.write.format("delta").mode("overwrite").partitionBy("processing_date").save("s3a://silver/customers/")
    print(f"✅ {silver.count()} customers → s3a://silver/customers/")


def transform_products(spark):
    """Bronze products → Silver."""
    print("\n🥈 Transform: products")
    bronze = spark.read.format("delta").load("s3a://bronze/erp/products/")

    silver = (
        bronze
        .filter(F.col("product_id").isNotNull())
        .filter(F.col("price") > 0)
        .withColumn("product_name", F.trim(F.col("product_name")))
        .withColumn("price_tier",
                    F.when(F.col("price") < 100, "cheap")
                    .when(F.col("price") < 1000, "mid")
                    .otherwise("premium"))
        .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
        .dropDuplicates(["product_id"])
    )

    silver.write.format("delta").mode("overwrite").partitionBy("processing_date").save("s3a://silver/products/")
    print(f"✅ {silver.count()} products → s3a://silver/products/")


def transform_orders(spark):
    """Bronze orders → Silver (explode items)."""
    print("\n🥈 Transform: orders")
    bronze = spark.read.format("delta").load("s3a://bronze/erp/orders/")

    # Explode items array
    orders_exploded = (
        bronze
        .withColumn("item", F.explode("items"))
        .select(
            "order_id", "customer_id", "order_date", "status",
            "payment_method", "shipping_city",
            F.col("item.product_id").alias("product_id"),
            F.col("item.quantity").alias("quantity"),
            F.col("item.unit_price").alias("unit_price"),
            F.col("item.subtotal").alias("line_total"),
            "total_amount", "num_items",
        )
    )

    silver = (
        orders_exploded
        .filter(F.col("order_id").isNotNull())
        .filter(F.col("quantity") > 0)
        .filter(F.col("unit_price") > 0)
        .withColumn("order_date", F.to_date("order_date"))
        .withColumn("processing_date", F.date_format(F.current_timestamp(), "yyyy-MM-dd"))
    )

    silver.write.format("delta").mode("overwrite").partitionBy("processing_date").save("s3a://silver/orders/")
    print(f"✅ {silver.count()} order lines → s3a://silver/orders/")


def main():
    spark = create_spark()
    spark.sparkContext.setLogLevel("WARN")

    print("=" * 60)
    print("🥈 BRONZE → SILVER TRANSFORM")
    print("=" * 60)

    transform_customers(spark)
    transform_products(spark)
    transform_orders(spark)

    print(f"\n{'='*60}")
    print("🎉 Silver layer done!")
    print("=" * 60)
    spark.stop()


if __name__ == "__main__":
    main()
