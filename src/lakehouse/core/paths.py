from __future__ import annotations

from lakehouse.core.constants import Layer, StorageEnv
from lakehouse.core.datasets import (
    DEFAULT_DATABASE,
    default_database_for,
    normalize_database,
    normalize_table,
)
from lakehouse.core.env import get_env, get_storage_env

#: Canonical bucket that holds every medallion layer.
#:
#: The TypeScript control plane addresses datasets as
#: ``s3://lakehouse/{layer}/{database}/{table}``. Python used to address them
#: as ``s3a://{layer}/`` (one bucket per layer), so the two halves of the
#: system could never see the same table. MASTER PLAN §10.2 requires one
#: canonical storage location; this constant is that single source of truth.
DEFAULT_BUCKET = "lakehouse"


class LakePaths:
    """Resolve layer paths from the active environment.

    - local/aws/r2:  ``s3a://<bucket>/<layer>/<database>/<table>/``
    - databricks:    ``/Volumes/<catalog>/<layer>/<volume>/<database>/<table>/``
                     (volume mode, default) or ``dbfs:/lakehouse/<layer>/...``

    A *database* is the source-system / domain segment (``crm``, ``erp``,
    ``clickstream``, ``ecommerce``). It is part of the canonical dataset
    identity — see :mod:`lakehouse.core.datasets`.
    """

    def __init__(self, env: StorageEnv | None = None, *, bucket: str | None = None) -> None:
        self.env = env or get_storage_env()
        self._bucket = (bucket or get_env("LAKEHOUSE_BUCKET", DEFAULT_BUCKET) or DEFAULT_BUCKET).strip("/")
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

    # ------------------------------------------------------------------
    # Canonical dataset paths
    # ------------------------------------------------------------------
    def table_path(self, layer: Layer, database: str, table: str) -> str:
        """Return the canonical storage path of one dataset."""
        db = (database or "").strip().lower()
        name = (table or "").strip().lower()
        if not db or not name:
            raise ValueError("database and table are required to build a dataset path")
        if self.env == StorageEnv.DATABRICKS:
            if self._dbx_path_mode == "dbfs":
                base = {
                    Layer.BRONZE: self._dbfs_bronze,
                    Layer.SILVER: self._dbfs_silver,
                    Layer.GOLD: self._dbfs_gold,
                }[layer].rstrip("/")
                return f"{base}/{db}/{name}/"
            base = self._volume_base(layer).rstrip("/")
            return f"{base}/{db}/{name}/"
        return f"{self._protocol}://{self._bucket}/{layer.value}/{db}/{name}/"

    def resolve_table(self, layer: Layer, fragment: str) -> tuple[str, str]:
        """Resolve a ``database/table`` fragment (or bare table) to a pair.

        This is the single place that turns the legacy fragment style used by
        the Python pipelines (``"crm/customers"``, ``"customers"``) into the
        canonical ``(database, table)`` pair.
        """
        sub = (fragment or "").strip("/")
        if not sub:
            raise ValueError("table fragment must not be empty")
        if "/" in sub:
            database, _, table = sub.partition("/")
            return normalize_database(database), normalize_table(table)
        return default_database_for(sub), normalize_table(sub)

    def resolve_path(self, layer: Layer, fragment: str) -> str:
        """Resolve a table fragment directly to its canonical storage path."""
        database, table = self.resolve_table(layer, fragment)
        return self.table_path(layer, database, table)

    def table_name(self, layer: Layer, name: str) -> str:
        """Return the fully-qualified Delta table name for a layer.

        For Databricks this is ``<catalog>.<layer>.<name>`` so callers can use
        ``spark.read.table("workspace.bronze.customers")``. For other
        environments it raises — use :meth:`table_path` instead.
        """
        if self.env != StorageEnv.DATABRICKS:
            raise ValueError(
                "table_name() is only valid when ENV=databricks "
                "(use table_path() for S3/DBFS paths)"
            )
        return f"{self._catalog}.{layer.value}.{name}"

    # ------------------------------------------------------------------
    # Backwards-compatible helpers
    # ------------------------------------------------------------------
    def _layer_root(self, layer: Layer) -> str:
        if self.env == StorageEnv.DATABRICKS:
            if self._dbx_path_mode == "dbfs":
                return {
                    Layer.BRONZE: self._dbfs_bronze,
                    Layer.SILVER: self._dbfs_silver,
                    Layer.GOLD: self._dbfs_gold,
                }[layer].rstrip("/") + "/"
            return self._volume_base(layer).rstrip("/") + "/"
        return f"{self._protocol}://{self._bucket}/{layer.value}/"

    def bronze(self, sub_path: str = "") -> str:
        return self._resolve(Layer.BRONZE, sub_path)

    def silver(self, sub_path: str = "") -> str:
        return self._resolve(Layer.SILVER, sub_path)

    def gold(self, sub_path: str = "") -> str:
        return self._resolve(Layer.GOLD, sub_path)

    def _resolve(self, layer: Layer, sub_path: str) -> str:
        """Resolve a legacy ``sub_path`` fragment to a canonical path.

        ``sub_path`` may be ``"crm/customers"`` (database + table) or a bare
        table name, in which case the database is inferred from
        :func:`lakehouse.core.datasets.default_database_for`.
        """
        sub = (sub_path or "").strip("/")
        if not sub:
            return self._layer_root(layer)
        if "/" in sub:
            database, _, table = sub.partition("/")
            return self.table_path(layer, database, table)
        return self.table_path(layer, default_database_for(sub), sub)

    def checkpoint(self, layer: Layer, sub_path: str) -> str:
        if self.env == StorageEnv.DATABRICKS:
            if self._dbx_path_mode == "dbfs":
                base = self._dbfs_checkpoint.rstrip("/")
                return f"{base}/{layer.value}/{sub_path}/_checkpoints/"
            base = self._volume_base(layer).rstrip("/")
            return f"{base}/_checkpoints/{sub_path}/"
        base = self._layer_root(layer).rstrip("/")
        return f"{base}/_checkpoints/{sub_path}/"

    # ------------------------------------------------------------------
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
    def bucket(self) -> str:
        """Canonical bucket name (non-Databricks environments)."""
        return self._bucket

    @property
    def is_databricks(self) -> bool:
        return self.env == StorageEnv.DATABRICKS

    @property
    def catalog(self) -> str:
        """UC catalog name (databricks) or empty string for other envs."""
        return getattr(self, "_catalog", "") or ""

    @property
    def default_database(self) -> str:
        return DEFAULT_DATABASE


def get_default_paths() -> LakePaths:
    return LakePaths()
