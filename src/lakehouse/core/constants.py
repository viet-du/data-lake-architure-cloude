from __future__ import annotations
from enum import Enum

class Layer(str, Enum):
    BRONZE = 'bronze'
    SILVER = 'silver'
    GOLD = 'gold'

class StorageEnv(str, Enum):
    LOCAL = 'local'
    AWS = 'aws'
    GCP = 'gcp'
    AZURE = 'azure'

class KafkaTopics:
    CLICKSTREAM_EVENTS = 'clickstream-events'
    ECOMMERCE_PRODUCTS = 'ecommerce-products-stream'
    ECOMMERCE_REVIEWS = 'ecommerce-reviews-stream'
    ECOMMERCE_PRICES = 'ecommerce-price-stream'
    GITHUB_TRENDING = 'github-trending-stream'
    CRYPTO_PRICES = 'crypto-prices-stream'
    WEATHER = 'weather-stream'
    HACKERNEWS = 'hackernews-stream'
    TIKI_CATEGORY = 'tiki-category-stream'

    @classmethod
    def all(cls) -> list[str]:
        return [v for (k, v) in vars(cls).items() if not k.startswith('_') and isinstance(v, str) and (not k.isupper()) or (k == 'CLICKSTREAM_EVENTS' and v == 'clickstream-events')]

    @classmethod
    def ecommerce_topics(cls) -> list[str]:
        return [cls.ECOMMERCE_PRODUCTS, cls.ECOMMERCE_REVIEWS, cls.ECOMMERCE_PRICES]
DELTA_PACKAGE = 'io.delta:delta-spark_2.12:3.0.0'
KAFKA_PACKAGE = 'org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0'
DEFAULT_PARTITION_BY = 'processing_date'
DEFAULT_KAFKA_BOOTSTRAP = 'localhost:9092'
DEFAULT_MINIO_ENDPOINT = 'localhost:9000'