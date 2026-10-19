"""Experiment 01 — Schema evolution, time travel, and OPTIMIZE.  # noqa: N999

Rubric line addressed:
  "Thử thêm cột, cập nhật bản ghi, truy vấn phiên bản cũ và compact tệp nhỏ."

What this script does (no Docker required — writes to local Delta):
  1.  Write v0: 5 rows with columns [id, name, price].
  2.  v1: write 5 more rows + new column ``discount_pct`` (autoMerge lets the
        writer extend the schema; existing rows get NULL for the new col).
  3.  v2: UPDATE one existing row's ``price`` (Delta MERGE).
  4.  Show ``DESCRIBE HISTORY`` of the table to enumerate versions.
  5.  Time travel back to v0 (``VERSION AS OF 0``) and verify the schema
      does not have ``discount_pct`` and the updated row is back to its
      original price.
  6.  Measure file count + bytes BEFORE and AFTER ``OPTIMIZE`` and write
      the deltas to ``results/01_schema_evolution.csv``.

The script is idempotent: every run starts from a clean workspace.
"""

from __future__ import annotations

import sys
from pathlib import Path

from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from experiments._common import (  # noqa: E402
    build_local_spark,
    delta_table_stats,
    measure_table_size,
    reset_workspace,
    run_step,
    write_results_csv,
)


def _seed_v0(spark, table_path: str) -> None:
    """Write the initial 5 rows."""
    df = spark.sql("""
        SELECT * FROM VALUES
            (1, 'Apple', 100.0),
            (2, 'Banana', 50.0),
            (3, 'Cherry', 200.0),
            (4, 'Date', 75.0),
            (5, 'Elderberry', 150.0)
        AS products(id, name, price)
        """)
    df.write.format("delta").mode("overwrite").save(table_path)


def _write_v1_with_new_column(spark, table_path: str) -> None:
    """Append 5 rows with an extra column ``discount_pct`` (schema evolution)."""
    df = spark.sql("""
        SELECT * FROM VALUES
            (6, 'Fig', 80.0, 10.0),
            (7, 'Grape', 120.0, 15.0),
            (8, 'Honeydew', 60.0, 5.0),
            (9, 'Jackfruit', 250.0, 0.0),
            (10, 'Kiwi', 90.0, 20.0)
        AS products(id, name, price, discount_pct)
        """)
    (df.write.format("delta").mode("append").option("mergeSchema", "true").save(table_path))


def _update_v2_row(spark, table_path: str) -> None:
    """UPDATE id=1 to set price=99.0 via Delta MERGE (ACID)."""
    from delta.tables import DeltaTable

    delta = DeltaTable.forPath(spark, table_path)
    updates = spark.sql("SELECT 1 AS id, 99.0 AS new_price")
    (
        delta.alias("t")
        .merge(updates.alias("u"), "t.id = u.id")
        .whenMatchedUpdate(set={"price": "u.new_price"})
        .execute()
    )


def _show_history(spark, table_path: str) -> list[dict[str, str]]:
    """Return the Delta history as a list of dicts (for the audit log)."""
    hist = spark.sql(f"DESCRIBE HISTORY delta.`{table_path}`").collect()
    return [
        {
            "version": str(row["version"]),
            "timestamp": str(row["timestamp"]),
            "operation": row["operation"],
            "operationParameters": str(row.asDict().get("operationParameters", "")),
        }
        for row in hist
    ]


def main() -> None:
    spark = build_local_spark("Experiment01-SchemaEvolution")
    try:
        results: list[dict] = []
        table_path = reset_workspace("exp01") / "products_delta"

        print("STEP 1 — write v0 (5 rows, 3 columns)")
        run_step("v0_initial_write", lambda: _seed_v0(spark, str(table_path)))

        size_v0 = measure_table_size(spark, str(table_path))
        print(
            f"  v0: rows={size_v0['row_count']} files={size_v0['file_count']} "
            f"bytes={size_v0['total_bytes']}"
        )
        results.append({"step": "v0", **size_v0})

        print("STEP 2 — append v1 with new column ``discount_pct``")
        run_step("v1_append_new_column", lambda: _write_v1_with_new_column(spark, str(table_path)))

        size_v1 = measure_table_size(spark, str(table_path))
        print(
            f"  v1: rows={size_v1['row_count']} files={size_v1['file_count']} "
            f"bytes={size_v1['total_bytes']}"
        )
        results.append({"step": "v1_schema_evolved", **size_v1})

        # Verify the new column exists
        cols_v1 = [
            r["col_name"] for r in spark.sql(f"DESCRIBE TABLE delta.`{table_path}`").collect()
        ]
        assert "discount_pct" in cols_v1, f"schema evolution failed, cols={cols_v1}"

        print("STEP 3 — UPDATE id=1 via Delta MERGE")
        run_step("v2_update_row", lambda: _update_v2_row(spark, str(table_path)))

        size_v2 = measure_table_size(spark, str(table_path))
        print(
            f"  v2: rows={size_v2['row_count']} files={size_v2['file_count']} "
            f"bytes={size_v2['total_bytes']}"
        )
        results.append({"step": "v2_after_update", **size_v2})

        print("STEP 4 — DESCRIBE HISTORY")
        hist = _show_history(spark, str(table_path))
        for h in hist:
            print(f"  v{h['version']}: {h['operation']} @ {h['timestamp']}")
        results.append({"step": "history_versions", "history": str(len(hist))})

        print("STEP 5 — time travel back to v0 (VERSION AS OF 0)")
        v0_again = spark.read.format("delta").option("versionAsOf", 0).load(str(table_path))
        v0_cols = v0_again.columns
        v0_price_id1 = v0_again.filter(F.col("id") == 1).first()["price"]
        assert "discount_pct" not in v0_cols, "time travel failed: new col still present"
        assert (
            v0_price_id1 == 100.0
        ), f"time travel failed: id=1 price={v0_price_id1}, expected 100.0"
        print(f"  v0 schema: {v0_cols}")
        print(f"  id=1 price at v0: {v0_price_id1} (expected 100.0)")
        results.append(
            {
                "step": "v0_time_travel_verified",
                "cols_count": len(v0_cols),
                "id1_price": float(v0_price_id1),
            }
        )

        print("STEP 6 — compact with OPTIMIZE")
        before = delta_table_stats(spark, table_path)
        print(f"  before OPTIMIZE: files={before['file_count']} " f"bytes={before['total_bytes']}")
        run_step("optimize_compact", lambda: spark.sql(f"OPTIMIZE delta.`{table_path}`").collect())
        after = delta_table_stats(spark, table_path)
        print(f"  after OPTIMIZE:  files={after['file_count']} " f"bytes={after['total_bytes']}")
        results.append({"step": "before_optimize", **before})
        results.append({"step": "after_optimize", **after})
        results.append(
            {
                "step": "delta_after_optimize",
                "file_count_delta": after["file_count"] - before["file_count"],
                "bytes_delta": after["total_bytes"] - before["total_bytes"],
            }
        )

        out = write_results_csv("01_schema_evolution", results)
        print(f"\nResults written to {out}")
        print("PASS — experiment 01 completed all 6 steps.")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
