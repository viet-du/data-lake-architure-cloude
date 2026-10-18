from __future__ import annotations

from enum import Enum


class Layer(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"


class StorageEnv(str, Enum):
    LOCAL = "local"
    AWS = "aws"
    GCP = "gcp"
    AZURE = "azure"
    R2 = "r2"  # Cloudflare R2 (S3-compatible, 0$ egress)
    DATABRICKS = "databricks"  # Databricks Community Edition (UC Volumes)


class KafkaTopics:
    CLICKSTREAM_EVENTS = "clickstream-events"
    ECOMMERCE_PRODUCTS = "ecommerce-products-stream"
    ECOMMERCE_REVIEWS = "ecommerce-reviews-stream"
    ECOMMERCE_PRICES = "ecommerce-price-stream"
    GITHUB_TRENDING = "github-trending-stream"
    CRYPTO_PRICES = "crypto-prices-stream"
    HACKERNEWS = "hackernews-stream"
    TIKI_CATEGORY = "tiki-category-stream"

    @classmethod
    def all(cls) -> list[str]:
        return [v for (k, v) in vars(cls).items() if not k.startswith("_") and isinstance(v, str)]

    @classmethod
    def ecommerce_topics(cls) -> list[str]:
        return [cls.ECOMMERCE_PRODUCTS, cls.ECOMMERCE_REVIEWS, cls.ECOMMERCE_PRICES]


DELTA_PACKAGE = "io.delta:delta-spark_2.12:3.0.0"
KAFKA_PACKAGE = "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.6"
HADOOP_AWS_PACKAGE = "org.apache.hadoop:hadoop-aws:3.3.4"
AWS_JAVA_SDK_PACKAGE = "com.amazonaws:aws-java-sdk-bundle:1.12.262"
DEFAULT_PARTITION_BY = "processing_date"
DEFAULT_KAFKA_BOOTSTRAP = "localhost:9092"
DEFAULT_MINIO_ENDPOINT = "localhost:9000"
# Cloudflare R2 endpoint template: <account_id>.r2.cloudflarestorage.com
# No default — must be set via R2_ACCOUNT_ID env var when StorageEnv.R2 is used.
DEFAULT_R2_ENDPOINT_TEMPLATE = "{account_id}.r2.cloudflarestorage.com"
