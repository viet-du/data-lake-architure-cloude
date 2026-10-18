from __future__ import annotations

import os

from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.paths import LakePaths


class TestLakePaths:
    def setup_method(self) -> None:
        for k in (
            "DATABRICKS_PATH_MODE",
            "DATABRICKS_CATALOG",
            "DATABRICKS_BRONZE_VOLUME",
            "DATABRICKS_SILVER_VOLUME",
            "DATABRICKS_GOLD_VOLUME",
            "DATABRICKS_CHECKPOINT_VOLUME",
        ):
            os.environ.pop(k, None)
        self.paths = LakePaths(env=StorageEnv.LOCAL)

    def test_bronze_path(self) -> None:
        assert self.paths.bronze("crm/customers") == "s3a://bronze/crm/customers/"

    def test_silver_path(self) -> None:
        assert self.paths.silver("customers") == "s3a://silver/customers/"

    def test_gold_path(self) -> None:
        assert self.paths.gold("fact_orders") == "s3a://gold/fact_orders/"

    def test_bronze_no_subpath(self) -> None:
        assert self.paths.bronze() == "s3a://bronze/"

    def test_checkpoint_path(self) -> None:
        ckpt = self.paths.checkpoint(Layer.BRONZE, "clickstream/events")
        assert ckpt == "s3a://bronze/clickstream/events/_checkpoints/"

    def test_gcp_protocol(self) -> None:
        gcp_paths = LakePaths(env=StorageEnv.GCP)
        assert gcp_paths.bronze("crm").startswith("gs://")

    def test_aws_protocol(self) -> None:
        aws_paths = LakePaths(env=StorageEnv.AWS)
        assert aws_paths.silver("crm").startswith("s3a://")


class TestLakePathsDatabricks:
    """Databricks Unity Catalog volume paths (default mode, recommended for CE)."""

    def setup_method(self) -> None:
        os.environ["DATABRICKS_PATH_MODE"] = "volume"
        os.environ["DATABRICKS_CATALOG"] = "workspace"
        self.paths = LakePaths(env=StorageEnv.DATABRICKS)

    def test_databricks_volume_path(self) -> None:
        assert (
            self.paths.bronze("crm/customers")
            == "/Volumes/workspace/bronze/bronze_data/crm/customers/"
        )

    def test_checkpoint_in_bronze_volume(self) -> None:
        assert self.paths.checkpoint(
            Layer.BRONZE, "events"
        ) == "/Volumes/workspace/bronze/bronze_data/_checkpoints/events/"

    def test_table_name_three_part(self) -> None:
        assert self.paths.table_name(Layer.SILVER, "dim_x") == "workspace.silver.dim_x"
