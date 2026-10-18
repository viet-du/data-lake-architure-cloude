from __future__ import annotations

from lakehouse.core.constants import KafkaTopics, Layer, StorageEnv


class TestLayerValues:
    def test_bronze_value(self) -> None:
        assert Layer.BRONZE.value == "bronze"

    def test_silver_value(self) -> None:
        assert Layer.SILVER.value == "silver"

    def test_gold_value(self) -> None:
        assert Layer.GOLD.value == "gold"


class TestKafkaTopics:
    def test_clickstream_topic(self) -> None:
        assert KafkaTopics.CLICKSTREAM_EVENTS == "clickstream-events"

    def test_ecommerce_products_topic(self) -> None:
        assert KafkaTopics.ECOMMERCE_PRODUCTS == "ecommerce-products-stream"

    def test_ecommerce_reviews_topic(self) -> None:
        assert KafkaTopics.ECOMMERCE_REVIEWS == "ecommerce-reviews-stream"

    def test_ecommerce_prices_topic(self) -> None:
        assert KafkaTopics.ECOMMERCE_PRICES == "ecommerce-price-stream"

    def test_ecommerce_topics_returns_3(self) -> None:
        topics = KafkaTopics.ecommerce_topics()
        assert len(topics) == 3
        assert KafkaTopics.ECOMMERCE_PRODUCTS in topics
        assert KafkaTopics.ECOMMERCE_REVIEWS in topics
        assert KafkaTopics.ECOMMERCE_PRICES in topics

    def test_all_topics_returns_list(self) -> None:
        all_t = KafkaTopics.all()
        assert isinstance(all_t, list)
        assert len(all_t) > 0
        # Each item should be a non-empty string
        for t in all_t:
            assert isinstance(t, str)
            assert len(t) > 0

    def test_all_topics_contains_core_topics(self) -> None:
        all_t = KafkaTopics.all()
        # Should contain all 7 defined topics (including CLICKSTREAM_EVENTS)
        assert len(all_t) >= 7
        # Verify that core topics are present
        found = [
            t
            for t in all_t
            if t
            in (
                "clickstream-events",
                "ecommerce-products-stream",
                "ecommerce-reviews-stream",
                "ecommerce-price-stream",
                "github-trending-stream",
                "crypto-prices-stream",
                "hackernews-stream",
                "tiki-category-stream",
            )
        ]
        assert len(found) >= 7, f"Expected at least 7 topics, got {found}"


class TestStorageEnvValues:
    def test_local_value(self) -> None:
        assert StorageEnv.LOCAL.value == "local"

    def test_aws_value(self) -> None:
        assert StorageEnv.AWS.value == "aws"

    def test_gcp_value(self) -> None:
        assert StorageEnv.GCP.value == "gcp"

    def test_azure_value(self) -> None:
        assert StorageEnv.AZURE.value == "azure"
