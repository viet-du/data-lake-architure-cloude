from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.paths import LakePaths

class TestLakePaths:

    def setup_method(self) -> None:
        self.paths = LakePaths(env=StorageEnv.LOCAL)

    def test_bronze_path(self) -> None:
        assert self.paths.bronze('crm/customers') == 's3a://bronze/crm/customers/'

    def test_silver_path(self) -> None:
        assert self.paths.silver('customers') == 's3a://silver/customers/'

    def test_gold_path(self) -> None:
        assert self.paths.gold('fact_orders') == 's3a://gold/fact_orders/'

    def test_bronze_no_subpath(self) -> None:
        assert self.paths.bronze() == 's3a://bronze/'

    def test_checkpoint_path(self) -> None:
        ckpt = self.paths.checkpoint(Layer.BRONZE, 'clickstream/events')
        assert ckpt == 's3a://bronze/clickstream/events/_checkpoints/'

    def test_gcp_protocol(self) -> None:
        gcp_paths = LakePaths(env=StorageEnv.GCP)
        assert gcp_paths.bronze('crm').startswith('gs://')

    def test_aws_protocol(self) -> None:
        aws_paths = LakePaths(env=StorageEnv.AWS)
        assert aws_paths.silver('crm').startswith('s3a://')