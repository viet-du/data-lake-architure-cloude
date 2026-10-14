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
