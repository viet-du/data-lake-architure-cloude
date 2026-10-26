"""Canonical dataset identity for the lakehouse.

A dataset is identified by ``(provider, layer, database, table)``. The storage
location is derived from that identity by :mod:`lakehouse.core.paths` — never
by ad-hoc string concatenation at call sites.

MASTER PLAN §02.2 (Single-Owner Principle), §05.1 (DatasetResolver) and
§10.2 ("Canonical storage location, qualified table mapping") require one
canonical mapping between the control-plane identity and the physical Delta
path. Before this module existed the TypeScript control plane used
``s3://lakehouse/{layer}/{database}/{table}`` while the Python lakehouse used
``s3a://{layer}/{sub_path}`` — two incompatible layouts for the same data.

Provider contract (MASTER PLAN §02.2):

======================  ====================================================
provider                storage
======================  ====================================================
local_delta_minio       ``s3a://<bucket>/<layer>/<database>/<table>``
databricks_uc           ``<catalog>.<schema>.<table>`` (Unity Catalog)
======================  ====================================================

``databricks_uc`` is read-only in this deployment: it has no Spark write
permission, so :func:`DatasetRef.can_mutate` is ``False`` for it. That keeps
the control plane from ever presenting a Databricks dataset as if it were a
MinIO dataset (MASTER PLAN §02.3, risk R-01).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

LAYERS: tuple[str, ...] = ("bronze", "silver", "gold")

PROVIDER_LOCAL = "local_delta_minio"
PROVIDER_DATABRICKS = "databricks_uc"

#: Database used when a caller only knows the table name.
DEFAULT_DATABASE = "default"

#: Canonical table → database mapping.
#:
#: The Python lakehouse historically used a two-segment path (``crm/customers``)
#: for Bronze and a bare table name for Silver/Gold. The control plane uses a
#: flat ``database.table`` identity everywhere. This table is the bridge: it
#: says which database a known dataset belongs to, so a bare table name still
#: resolves to one canonical path instead of guessing.
TABLE_DATABASE: dict[str, str] = {
    # Bronze / Silver source datasets
    "customers": "crm",
    "products": "erp",
    "orders": "erp",
    # Streaming datasets
    "events": "clickstream",
    "unique_metrics_5min": "clickstream",
    "crawler_records": "crawler",
    "crawler_records_delta": "crawler",
    "crawler_source_metrics_delta": "crawler",
    # Gold aggregates
    "fact_orders": "retail",
    "dim_customers": "retail",
    "dim_products": "retail",
    "daily_revenue": "retail",
}


def default_database_for(table: str) -> str:
    """Return the canonical database for a known table, else ``default``."""
    return TABLE_DATABASE.get((table or "").strip().lower(), DEFAULT_DATABASE)


#: Canonical Silver sources of every Gold aggregate.
#:
#: A Gold dataset lives in the ``retail`` database segment, but the Silver
#: datasets it aggregates live in *their own* segments (``erp/orders``,
#: ``crm/customers``). Resolving a Gold source with the Gold database
#: segment would point Spark at a path that does not exist, so the mapping
#: is declared here and mirrored by ``GOLD_AGGREGATE_SOURCES`` in the
#: TypeScript control plane.
GOLD_AGGREGATE_SOURCES: dict[str, tuple[str, ...]] = {
    "fact_orders": ("orders", "customers", "products"),
    "dim_customers": ("customers", "orders"),
    "dim_products": ("products", "orders"),
    "daily_revenue": ("orders",),
}

#: Silver source attribute of each aggregator, keyed by source table name.
GOLD_SOURCE_ATTRIBUTES: dict[str, str] = {
    "orders": "SILVER_ORDERS",
    "customers": "SILVER_CUSTOMERS",
    "products": "SILVER_PRODUCTS",
}

#: Natural primary key of each canonical dataset.
#:
#: The key is a property of the *dataset*, not of the database segment: an
#: ``orders`` table is keyed by ``order_id`` whether it lives in ``erp`` or in
#: a QA segment. Bronze ingestion uses it to MERGE instead of APPEND, which
#: is what makes a retried ingestion idempotent (MASTER PLAN P0-BR-02).
NATURAL_KEY_BY_TABLE: dict[str, str] = {
    "customers": "customer_id",
    "products": "product_id",
    "orders": "order_id",
    "events": "event_id",
}


def resolve_gold_source(table: str) -> tuple[str, str] | None:
    """Resolve a Gold source table name to its canonical ``(database, table)``.

    Accepts the bare form (``orders``), the slash form (``erp/orders``) and
    the dotted form (``erp.orders``). Returns ``None`` when the name is not
    a known Gold source, so an unrelated table is never silently substituted.
    """
    raw = (table or "").strip().lower()
    if not raw:
        return None
    if "/" in raw:
        database, _, name = raw.partition("/")
    elif "." in raw:
        database, _, name = raw.partition(".")
    else:
        database, name = default_database_for(raw), raw
    if name not in GOLD_SOURCE_ATTRIBUTES:
        return None
    try:
        return normalize_database(database), normalize_table(name)
    except ValueError:
        return None

#: Databricks is browse/read-only here — see MASTER PLAN §02.2 provider table.
READ_ONLY_PROVIDERS: frozenset[str] = frozenset({PROVIDER_DATABRICKS})

_SEGMENT_RE = re.compile(r"^[a-z0-9][a-z0-9_]*$")


def normalize_layer(value: str) -> str:
    """Return a validated layer name."""
    candidate = (value or "").strip().lower()
    if candidate not in LAYERS:
        raise ValueError(f"Invalid layer: {value!r} (expected one of {LAYERS})")
    return candidate


def normalize_database(value: str) -> str:
    """Return a validated database (source-system / domain) segment."""
    candidate = (value or "").strip().lower()
    if not _SEGMENT_RE.match(candidate):
        raise ValueError(f"Invalid database: {value!r}")
    return candidate


def normalize_table(value: str) -> str:
    """Return a validated table segment."""
    candidate = (value or "").strip().lower()
    if not _SEGMENT_RE.match(candidate):
        raise ValueError(f"Invalid table: {value!r}")
    return candidate


@dataclass(frozen=True)
class DatasetRef:
    """Canonical, provider-aware identity of a single dataset."""

    provider: str
    layer: str
    database: str
    table: str

    @property
    def key(self) -> str:
        """Provider-independent identity used by the control plane."""
        return f"{self.layer}.{self.database}.{self.table}"

    @property
    def qualified(self) -> str:
        """Fully-qualified identity including the provider."""
        return f"{self.provider}/{self.key}"

    @property
    def can_mutate(self) -> bool:
        """Whether an ETL/ELT write is permitted against this provider."""
        return self.provider not in READ_ONLY_PROVIDERS

    @classmethod
    def create(
        cls,
        *,
        provider: str,
        layer: str,
        database: str,
        table: str,
    ) -> "DatasetRef":
        return cls(
            provider=provider.strip().lower(),
            layer=normalize_layer(layer),
            database=normalize_database(database),
            table=normalize_table(table),
        )
