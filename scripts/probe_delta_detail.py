"""Probe the exact DeltaTable.detail() schema.

The job runner reads the snapshot metadata with `DeltaTable.detail()`. That
call returns a *DataFrame* (one row per table), not a dict, so a `.get(...)`
on it raises `AttributeError: 'DataFrame' object has no attribute 'get'`.
This probe prints the real column names so the fix uses the actual API
instead of a guess.
"""

from __future__ import annotations

import logging
import sys

logging.basicConfig(level=logging.INFO, stream=sys.stderr)

from lakehouse.core.paths import LakePaths  # noqa: E402
from lakehouse.core.constants import Layer  # noqa: E402
from lakehouse.core.spark import get_spark_session  # noqa: E402


def main() -> int:
    from delta.tables import DeltaTable

    spark = get_spark_session("DeltaDetailProbe")
    paths = LakePaths()
    path = paths.table_path(Layer.BRONZE, "erp", "orders")

    print("path =", path)
    print("isDeltaTable =", DeltaTable.isDeltaTable(spark, path))

    detail = DeltaTable.forPath(spark, path).detail()
    print("detail type =", type(detail))
    print("detail columns =", detail.columns)
    rows = detail.collect()
    print("detail row count =", len(rows))
    if rows:
        row = rows[0]
        as_dict = row.asDict()
        print("row keys =", sorted(as_dict.keys()))
        for key in sorted(as_dict.keys()):
            print(f"  {key} = {as_dict[key]!r}")

    history = DeltaTable.forPath(spark, path).history(1).collect()
    if history:
        h = history[0].asDict()
        print("history version =", h.get("version"))
        print("history keys =", sorted(h.keys()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
