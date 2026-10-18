from __future__ import annotations

from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.env import get_env, get_storage_env


class LakePaths:
    """
    Resolve layer (bronze/silver/gold) paths based on active environment.

    - local:  s3a://<bucket>/<sub>     (MinIO or R2, picked by S3_ENDPOINT)
    - r2:     s3a://<bucket>/<sub>     (Cloudflare R2, requires S3_ENDPOINT)
    - aws:    s3a://<bucket>/<sub>
    - gcp:    gs://<bucket>/<sub>
    - azure:  abfs://<bucket>/<sub>
    - databricks:
              Path mode is controlled by DATABRICKS_PATH_MODE env var:
                - "volume" (default, recommended for Community Edition):
                    /Volumes/<catalog>/<layer>/lakehouse/<sub>/
                    Each layer has a managed Unity Catalog Volume pre-created
                    by scripts/bootstrap_databricks.sh.  Path is absolute,
                    no DBFS root access required (CE blocks it).
                - "dbfs" (legacy, full Databricks workspaces only):
                    dbfs:/lakehouse/<layer>/<sub>/
                    Use this if your workspace allows DBFS root.

              For Delta tables (table_name()): <catalog>.<layer>.<name>
              (always goes through Unity Catalog — works on both CE and full).
    """

    def __init__(self, env: StorageEnv | None = None) -> None:
        self.env = env or get_storage_env()
        self._set_protocols()

    def _set_protocols(self) -> None:
        if self.env == StorageEnv.DATABRICKS:
            # ---- Path mode: "volume" (default) or "dbfs" (legacy) ----------
            self._dbx_path_mode = get_env("DATABRICKS_PATH_MODE", "volume").lower()
            self._catalog = get_env("DATABRICKS_CATALOG", "workspace")
            # Volume name per layer (each layer has its own UC Volume).
            self._bronze_volume = get_env("DATABRICKS_BRONZE_VOLUME", "bronze_data")
            self._silver_volume = get_env("DATABRICKS_SILVER_VOLUME", "silver_data")
            self._gold_volume = get_env("DATABRICKS_GOLD_VOLUME", "gold_data")
            self._checkpoint_volume = get_env(
                "DATABRICKS_CHECKPOINT_VOLUME", "checkpoints"
            )
            # Optional overrides (used when DATABRICKS_PATH_MODE=dbfs).
            self._dbfs_bronze = get_env(
                "DATABRICKS_BRONZE_PATH", "dbfs:/lakehouse/bronze"
            )
            self._dbfs_silver = get_env(
                "DATABRICKS_SILVER_PATH", "dbfs:/lakehouse/silver"
            )
            self._dbfs_gold = get_env(
                "DATABRICKS_GOLD_PATH", "dbfs:/lakehouse/gold"
            )
            self._dbfs_checkpoint = get_env(
                "DATABRICKS_CHECKPOINT_PATH", "dbfs:/lakehouse/_checkpoints"
            )
            return
        if self.env == StorageEnv.LOCAL:
            self._protocol = "s3a"
        elif self.env == StorageEnv.AWS:
            self._protocol = "s3a"
        elif self.env == StorageEnv.R2:
            self._protocol = "s3a"
        elif self.env == StorageEnv.GCP:
            self._protocol = "gs"
        elif self.env == StorageEnv.AZURE:
            self._protocol = "abfs"
        else:
            self._protocol = "s3a"

    def bronze(self, sub_path: str = "") -> str:
        return self._layer_path(Layer.BRONZE, sub_path)

    def silver(self, sub_path: str = "") -> str:
        return self._layer_path(Layer.SILVER, sub_path)

    def gold(self, sub_path: str = "") -> str:
        return self._layer_path(Layer.GOLD, sub_path)

    def checkpoint(self, layer: Layer, sub_path: str) -> str:
        if self.env == StorageEnv.DATABRICKS:
            if self._dbx_path_mode == "dbfs":
                base = self._dbfs_checkpoint.rstrip("/")
                return f"{base}/{layer.value}/{sub_path}/_checkpoints/"
            # Volume mode: write checkpoints inside the layer's own volume.
            base = self._volume_base(layer).rstrip("/")
            return f"{base}/_checkpoints/{sub_path}/"
        if layer == Layer.BRONZE:
            base = self.bronze("")
        elif layer == Layer.SILVER:
            base = self.silver("")
        else:
            base = self.gold("")
        return f"{base}{sub_path}/_checkpoints/"

    def table_name(self, layer: Layer, name: str) -> str:
        """
        Return fully-qualified Delta table name for a layer.
        For Databricks: returns `<catalog>.<layer>.<name>` so caller can use
        `spark.read.table("workspace.bronze.customers")`.
        For other envs: raises (use S3 paths instead).
        """
        if self.env != StorageEnv.DATABRICKS:
            raise ValueError(
                "table_name() is only valid when ENV=databricks "
                "(use bronze()/silver()/gold() for S3/DBFS paths)"
            )
        return f"{self._catalog}.{layer.value}.{name}"

    def _layer_path(self, layer: Layer, sub_path: str) -> str:
        if self.env == StorageEnv.DATABRICKS:
            if self._dbx_path_mode == "dbfs":
                base = {
                    Layer.BRONZE: self._dbfs_bronze,
                    Layer.SILVER: self._dbfs_silver,
                    Layer.GOLD: self._dbfs_gold,
                }[layer]
            else:
                base = self._volume_base(layer)
            base = base.rstrip("/")
            sub = sub_path.strip("/") if sub_path else ""
            return f"{base}/{sub}/" if sub else f"{base}/"
        bucket = layer.value
        sub = sub_path.strip("/") if sub_path else ""
        base = f"{self._protocol}://{bucket}/"
        return f"{base}{sub}/" if sub else base

    def _volume_base(self, layer: Layer) -> str:
        """Return absolute Volume path for a layer (databricks + volume mode)."""
        vol = {
            Layer.BRONZE: self._bronze_volume,
            Layer.SILVER: self._silver_volume,
            Layer.GOLD: self._gold_volume,
        }[layer]
        return f"/Volumes/{self._catalog}/{layer.value}/{vol}"

    @property
    def protocol(self) -> str:
        if self.env == StorageEnv.DATABRICKS:
            return "dbfs" if self._dbx_path_mode == "dbfs" else "volume"
        return self._protocol

    @property
    def is_databricks(self) -> bool:
        return self.env == StorageEnv.DATABRICKS

    @property
    def catalog(self) -> str:
        """UC catalog name (databricks) or empty string for other envs."""
        return getattr(self, "_catalog", "") or ""


def get_default_paths() -> LakePaths:
    return LakePaths()
