from __future__ import annotations

from lakehouse.schemas import (
    CLICKSTREAM_SCHEMA,
    CUSTOMER_SCHEMA,
    ECOMMERCE_PRODUCT_SCHEMA,
    ECOMMERCE_REVIEW_SCHEMA,
    ORDER_SCHEMA,
    PRODUCT_SCHEMA,
)


class TestRetailSchemas:
    def test_customer_schema_has_required_fields(self) -> None:
        names = CUSTOMER_SCHEMA.names
        assert "customer_id" in names
        assert "email" in names
        assert "age" in names

    def test_product_schema_has_required_fields(self) -> None:
        names = PRODUCT_SCHEMA.names
        assert "product_id" in names
        assert "price" in names
        assert "category" in names

    def test_order_schema_has_required_fields(self) -> None:
        names = ORDER_SCHEMA.names
        assert "order_id" in names
        assert "customer_id" in names
        assert "line_total" in names
        assert "product_id" in names


class TestStreamingSchemas:
    def test_clickstream_schema_has_required_fields(self) -> None:
        names = CLICKSTREAM_SCHEMA.names
        assert "event_id" in names
        assert "user_id" in names
        assert "event_type" in names
        assert "session_id" in names
        assert "timestamp" in names

    def test_ecommerce_product_schema_has_required_fields(self) -> None:
        names = ECOMMERCE_PRODUCT_SCHEMA.names
        assert "id" in names
        assert "price" in names
        assert "_source" in names

    def test_ecommerce_review_schema_has_required_fields(self) -> None:
        names = ECOMMERCE_REVIEW_SCHEMA.names
        assert "product_id" in names
        assert "rating" in names
        assert "content" in names

    def test_ecommerce_product_schema_has_metadata_fields(self) -> None:
        names = ECOMMERCE_PRODUCT_SCHEMA.names
        # These are added by crawler
        assert "_event_type" in names
        assert "_crawl_timestamp" in names
        assert "_source" in names
        assert "_kafka_topic" in names

    def test_clickstream_schema_event_type_field(self) -> None:
        """Verify event_type field is present and non-nullable."""
        for field in CLICKSTREAM_SCHEMA.fields:
            if field.name == "event_type":
                assert not field.nullable, "event_type should not be nullable"
                break
