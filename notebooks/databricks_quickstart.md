---
title: Data Lake Architecture — Quickstart Notebook (Databricks)
description: End-to-end smoke test on /Volumes/dbacademy/...
cluster: (auto-attach to Serverless or Single-Node cluster)
---

# Data Lake Architecture — Quickstart on Databricks

> **Mục đích:** Chạy pipeline Bronze→Silver→Gold end-to-end trên Databricks cluster
> của bạn, ghi vào `/Volumes/dbacademy/...`. Notebook này được thiết kế để
> dùng như một smoke test kèm theo project — copy từng cell xuống một
> notebook mới trên Databricks workspace, hoặc import cả file này.

---

## Cell 1 — Setup (chạy 1 lần đầu)

```python
# Cài delta-spark nếu cluster chưa có (Databricks runtime 14.x đã có sẵn,
# nhưng cell này đảm bảo tương thích với runtime cũ hơn).
%pip install delta-spark==3.0.0 --quiet

# Trỏ tới source code của project. Sau khi upload src/ lên workspace
# (ví dụ: /Workspace/Users/duviet720@gmail.com/data-lake-architecture/),
# đổi đường dẫn dưới đây cho khớp.
import sys
PROJECT_PATH = "/Workspace/Users/duviet720@gmail.com/data-lake-architecture"
sys.path.insert(0, f"{PROJECT_PATH}/src")
```

---

## Cell 2 — Verify storage layout

```python
from lakehouse.run_on_databricks import show_storage_layout
show_storage_layout()
```

Output mong đợi:

```
============================================================
  ENV      : databricks
  Catalog  : dbacademy
  Protocol : volume
  Bronze   : /Volumes/dbacademy/bronze/bronze_data/
  Silver   : /Volumes/dbacademy/silver/silver_data/
  Gold     : /Volumes/dbacademy/gold/gold_data/
  ...
  Tbl      : dbacademy.bronze.customers
============================================================
```

> Nếu ENV=local, bạn quên `export ENV=databricks` hoặc bạn đang chạy ngoài
> cluster. Đảm bảo notebook đang attach vào 1 compute (serverless hoặc cluster).

---

## Cell 3 — Smoke test (write → read)

Ghi 1 dataframe nhỏ vào Bronze layer, đọc lại, in row count.

```python
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from lakehouse.core.constants import Layer
from lakehouse.core.paths import LakePaths
from lakehouse.storage.delta_writer import write_delta_table

spark = SparkSession.builder.getOrCreate()
paths = LakePaths()
print(f"Bronze base path: {paths.bronze('')}")

# Tạo dataframe 5 rows
df = spark.createDataFrame(
    [
        (1, "alice", "alice@example.com"),
        (2, "bob",   "bob@example.com"),
        (3, "carol", "carol@example.com"),
        (4, "dave",  "dave@example.com"),
        (5, "eve",   "eve@example.com"),
    ],
    ["id", "name", "email"],
).withColumn("_ingestion_timestamp", F.current_timestamp())

# Ghi vào Bronze (Delta format)
write_delta_table(
    df,
    layer=Layer.BRONZE,
    table_name="smoke_test",
    paths=paths,
    mode="overwrite",
    partition_by=None,
    merge_schema=True,
)

# Đọc lại
df_back = spark.read.format("delta").load(paths.bronze("smoke_test"))
print(f"✅ Smoke test OK — wrote and read back {df_back.count()} rows")
df_back.show()
```

Output mong đợi:

```
✅ Smoke test OK — wrote and read back 5 rows
+---+-----+------------------+-----------------------+
| id|name |email             |_ingestion_timestamp   |
+---+-----+------------------+-----------------------+
|  1|alice|alice@example.com |2026-10-18 14:55:...   |
|  2|bob  |bob@example.com   |2026-10-18 14:55:...   |
|  ...                                                           |
+---+-----+------------------+-----------------------+
```

---

## Cell 4 — End-to-end batch retail pipeline

Chạy Bronze→Silver→Gold trên dataset retail có sẵn của Databricks.

```python
from lakehouse.run_on_databricks import run_batch_retail
run_batch_retail(limit=1000)  # smoke test với 1000 rows đầu
```

Sau khi chạy, verify bằng cách mở **Data → Databases → dbacademy** trên UI.

---

## Cell 5 — Cleanup (optional)

```python
# Xóa smoke test table
spark.sql("DROP TABLE IF EXISTS dbacademy.bronze.smoke_test")
# (Bronze layer là Delta, nên đây chỉ xóa table metadata; data vẫn còn
# trong /Volumes/dbacademy/bronze/bronze_data/smoke_test/. Vacuum để reclaim.)
spark.sql("VACUUM '/Volumes/dbacademy/bronze/bronze_data/smoke_test/' RETAIN 0 HOURS")
print("✅ Cleanup done")
```

---

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'lakehouse'` | `sys.path.insert` chưa chạy hoặc sai path | Chạy lại Cell 1 với đúng PROJECT_PATH |
| `AnalysisException: Path does not exist: dbfs:/...` | ENV=local hoặc DATABRICKS_PATH_MODE sai | Chạy lại Cell 2, kiểm tra output |
| `Catalog 'dbacademy' not found` | Chưa chạy bootstrap | Chạy `make databricks-bootstrap` từ local |
| `Permission denied: writing to /Volumes/...` | Catalog không phải của bạn | Đổi `DATABRICKS_CATALOG` sang catalog thuộc sở hữu bạn |
| Notebook không có output | Cluster chưa attach | Click "Connect" ở góc phải trên notebook |

---

## Đường dẫn hữu ích

- Setup guide: `docs/operations/DATABRICKS_SETUP.md`
- Entry point: `src/lakehouse/run_on_databricks.py`
- Bootstrap script: `scripts/bootstrap_databricks.sh`
- Diag script: `scripts/diag_databricks.sh`
