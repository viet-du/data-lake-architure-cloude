from lakehouse.schemas import CLICKSTREAM_SCHEMA, CUSTOMER_SCHEMA, ECOMMERCE_PRODUCT_SCHEMA, ECOMMERCE_REVIEW_SCHEMA, ORDER_SCHEMA, PRODUCT_SCHEMA

class TestRetailSchemas:

    def test_customer_schema(self) -> None:
        assert 'customer_id' in CUSTOMER_SCHEMA.names
        assert 'email' in CUSTOMER_SCHEMA.names
        assert 'age' in CUSTOMER_SCHEMA.names

    def test_product_schema(self) -> None:
        assert 'product_id' in PRODUCT_SCHEMA.names
        assert 'price' in PRODUCT_SCHEMA.names

    def test_order_schema(self) -> None:
        assert 'order_id' in ORDER_SCHEMA.names
        assert 'customer_id' in ORDER_SCHEMA.names
        assert 'line_total' in ORDER_SCHEMA.names

class TestStreamingSchemas:

    def test_clickstream_schema(self) -> None:
        assert 'event_id' in CLICKSTREAM_SCHEMA.names
        assert 'user_id' in CLICKSTREAM_SCHEMA.names

    def test_ecommerce_product_schema(self) -> None:
        assert 'id' in ECOMMERCE_PRODUCT_SCHEMA.names
        assert 'price' in ECOMMERCE_PRODUCT_SCHEMA.names
        assert '_source' in ECOMMERCE_PRODUCT_SCHEMA.names

    def test_ecommerce_review_schema(self) -> None:
        assert 'product_id' in ECOMMERCE_REVIEW_SCHEMA.names
        assert 'rating' in ECOMMERCE_REVIEW_SCHEMA.names