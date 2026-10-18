from __future__ import annotations

import os

from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.paths import LakePaths


class TestLakePathsLocal:
    def setup_method(self) -> None:
        self.paths = LakePaths(env=StorageEnv.LOCAL)

    def test_protocol_is_s3a(self) -> None:
        assert self.paths.protocol == "s3a"

    def test_bronze_with_subpath(self) -> None:
        assert self.paths.bronze("crm/customers") == "s3a://bronze/crm/customers/"

    def test_silver_with_subpath(self) -> None:
        assert self.paths.silver("customers") == "s3a://silver/customers/"

    def test_gold_with_subpath(self) -> None:
        assert self.paths.gold("fact_orders") == "s3a://gold/fact_orders/"

    def test_bronze_root(self) -> None:
        assert self.paths.bronze() == "s3a://bronze/"

    def test_silver_root(self) -> None:
        assert self.paths.silver() == "s3a://silver/"

    def test_gold_root(self) -> None:
        assert self.paths.gold() == "s3a://gold/"

    def test_checkpoint_bronze(self) -> None:
        ckpt = self.paths.checkpoint(Layer.BRONZE, "clickstream/events")
        assert ckpt == "s3a://bronze/clickstream/events/_checkpoints/"

    def test_checkpoint_silver(self) -> None:
        ckpt = self.paths.checkpoint(Layer.SILVER, "ecommerce/products")
        assert ckpt == "s3a://silver/ecommerce/products/_checkpoints/"

    def test_checkpoint_gold(self) -> None:
        ckpt = self.paths.checkpoint(Layer.GOLD, "fact_orders")
        assert ckpt == "s3a://gold/fact_orders/_checkpoints/"


class TestLakePathsDatabricksVolume:
    def setup_method(self) -> None:
        # Volume path mode (default) — recommended for Community Edition.
        os.environ["DATABRICKS_PATH_MODE"] = "volume"
        os.environ["DATABRICKS_CATALOG"] = "workspace"
        os.environ["DATABRICKS_BRONZE_VOLUME"] = "bronze_data"
        os.environ["DATABRICKS_SILVER_VOLUME"] = "silver_data"
        os.environ["DATABRICKS_GOLD_VOLUME"] = "gold_data"
        os.environ["DATABRICKS_CHECKPOINT_VOLUME"] = "checkpoints"
        self.paths = LakePaths(env=StorageEnv.DATABRICKS)

    def test_protocol_is_volume(self) -> None:
        assert self.paths.protocol == "volume"
        assert self.paths.is_databricks is True

    def test_bronze_path(self) -> None:
        assert (
            self.paths.bronze("crm/customers")
            == "/Volumes/workspace/bronze/bronze_data/crm/customers/"
        )

    def test_silver_path(self) -> None:
        assert (
            self.paths.silver("customers")
            == "/Volumes/workspace/silver/silver_data/customers/"
        )

    def test_gold_path(self) -> None:
        assert (
            self.paths.gold("fact_orders")
            == "/Volumes/workspace/gold/gold_data/fact_orders/"
        )

    def test_bronze_root(self) -> None:
        assert self.paths.bronze() == "/Volumes/workspace/bronze/bronze_data/"

    def test_checkpoint_uses_layer_volume(self) -> None:
        ckpt = self.paths.checkpoint(Layer.BRONZE, "clickstream/events")
        assert (
            ckpt == "/Volumes/workspace/bronze/bronze_data/_checkpoints/clickstream/events/"
        )

    def test_table_name_three_part(self) -> None:
        assert self.paths.table_name(Layer.BRONZE, "customers") == "workspace.bronze.customers"
        assert self.paths.table_name(Layer.GOLD, "fact_orders") == "workspace.gold.fact_orders"

    def test_catalog_property(self) -> None:
        assert self.paths.catalog == "workspace"

    def test_table_name_raises_for_non_databricks(self) -> None:
        local = LakePaths(env=StorageEnv.LOCAL)
        try:
            local.table_name(Layer.BRONZE, "x")
        except ValueError as e:
            assert "only valid when ENV=databricks" in str(e)
        else:
            raise AssertionError("Expected ValueError")


class TestLakePathsDatabricksDbfsLegacy:
    def setup_method(self) -> None:
        os.environ["DATABRICKS_PATH_MODE"] = "dbfs"
        os.environ["DATABRICKS_BRONZE_PATH"] = "dbfs:/lakehouse/bronze"
        os.environ["DATABRICKS_SILVER_PATH"] = "dbfs:/lakehouse/silver"
        os.environ["DATABRICKS_GOLD_PATH"] = "dbfs:/lakehouse/gold"
        os.environ["DATABRICKS_CHECKPOINT_PATH"] = "dbfs:/lakehouse/_checkpoints"
        self.paths = LakePaths(env=StorageEnv.DATABRICKS)

    def test_protocol_is_dbfs(self) -> None:
        assert self.paths.protocol == "dbfs"

    def test_bronze_uses_dbfs(self) -> None:
        assert self.paths.bronze("crm") == "dbfs:/lakehouse/bronze/crm/"

    def test_checkpoint_uses_dbfs(self) -> None:
        ckpt = self.paths.checkpoint(Layer.SILVER, "events")
        assert ckpt == "dbfs:/lakehouse/_checkpoints/silver/events/_checkpoints/"


class TestLakePathsProtocols:
    def test_gcp_protocol(self) -> None:
        gcp_paths = LakePaths(env=StorageEnv.GCP)
        assert gcp_paths.protocol == "gs"
        assert gcp_paths.bronze("crm").startswith("gs://")

    def test_aws_protocol(self) -> None:
        aws_paths = LakePaths(env=StorageEnv.AWS)
        assert aws_paths.protocol == "s3a"
        assert aws_paths.silver("crm").startswith("s3a://")

    def test_azure_protocol(self) -> None:
        azure_paths = LakePaths(env=StorageEnv.AZURE)
        assert azure_paths.protocol == "abfs"
        assert azure_paths.gold("fact").startswith("abfs://")

    def test_default_falls_back_to_local(self) -> None:
        # Clear ENV and import fresh
        os.environ.pop("ENV", None)
        from lakehouse.core.paths import get_default_paths

        # get_default_paths should not raise
        paths = get_default_paths()
        assert paths.protocol in ("s3a", "gs", "abfs")
