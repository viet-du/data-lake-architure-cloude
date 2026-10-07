from lakehouse.core.constants import KafkaTopics, Layer, StorageEnv

class TestLayer:

    def test_layer_values(self) -> None:
        assert Layer.BRONZE.value == 'bronze'
        assert Layer.SILVER.value == 'silver'
        assert Layer.GOLD.value == 'gold'

class TestKafkaTopics:

    def test_clickstream_topic(self) -> None:
        assert KafkaTopics.CLICKSTREAM_EVENTS == 'clickstream-events'

    def test_ecommerce_topics(self) -> None:
        topics = KafkaTopics.ecommerce_topics()
        assert KafkaTopics.ECOMMERCE_PRODUCTS in topics
        assert KafkaTopics.ECOMMERCE_REVIEWS in topics
        assert KafkaTopics.ECOMMERCE_PRICES in topics
        assert len(topics) == 3

class TestStorageEnv:

    def test_storage_env_values(self) -> None:
        assert StorageEnv.LOCAL.value == 'local'
        assert StorageEnv.AWS.value == 'aws'
        assert StorageEnv.GCP.value == 'gcp'
        assert StorageEnv.AZURE.value == 'azure'