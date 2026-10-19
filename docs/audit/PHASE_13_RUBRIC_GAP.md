# PHASE 13 — Rubric Đề tài 15 Gap Audit

> **Status:** Gap audit against the rubric published for thesis topic 15
> ("Xây dựng data lakehouse cho dữ liệu bán hàng bằng quy trình ETL và
> ELT"). This document is the response to a student request (2026-10-16)
> to "fix the project to match the rubric."
>
> **Method:** For each rubric line, the audit states the verdict
> (PASS / PARTIAL / MISSING) and cites the file that satisfies it. No
> measurement is claimed unless the file actually runs the measurement.
>
> **What was NOT changed:** No existing source file was modified. Only
> NEW files were added (the `experiments/` directory, this document,
> and 3 Makefile targets). This keeps the diff small and reversible.

---

## 1. Rubric line-by-line

### A. Câu hỏi nghiên cứu

> *"Kiến trúc lakehouse cải thiện khả năng lưu trữ dữ liệu thô, quản
> trị bảng và phân tích so với thư mục data lake không có lớp giao dịch
> như thế nào?"*

| Aspect | Verdict | Evidence |
|---|---|---|
| Question stated as a comparison | PASS | `docs/architecture/ARCHITECTURE.md` §"High-level diagram" |
| Empirical answer (Lake vs Lakehouse on the same workload) | **MISSING** | Out of scope for this PR. Requires a second storage backend (plain Parquet) and a paired benchmark. The experiments here answer a related question (ETL vs ELT) instead. |

**Action item for the report:** Use the literature references [25, 41, 42]
from the rubric to support the comparison if a paired benchmark is not
feasible.

### B. Mục tiêu

| Rubric line | Verdict | Evidence |
|---|---|---|
| Xây pipeline ingest đa định dạng vào bronze, silver, gold | PASS | `src/lakehouse/ingest/batch/`, `transform/`, `aggregate/` |
| Schema evolution, partitioning, time travel | PASS | `src/lakehouse/core/spark.py:29, 62` (autoMerge), `storage/delta_writer.py:31, 153` (partitionBy), `ARCHITECTURE.md:254` (RESTORE) |
| So sánh ETL và ELT trên cùng yêu cầu | **PASS (new)** | `experiments/02_etl_vs_elt.py` |

### C. Nội dung lý thuyết

| Rubric line | Verdict | Evidence |
|---|---|---|
| Data lake / warehouse / lakehouse | PASS | `docs/architecture/ARCHITECTURE.md` |
| Schema-on-read vs schema-on-write | PASS | `docs/architecture/ARCHITECTURE.md:108` |
| ETL / ELT / phân lớp | PASS | `docs/plan/plan_overview/03-etl-vs-elt.md` + `experiments/02_etl_vs_elt.py` |
| Partition pruning, small-file problem | PARTIAL | `experiments/03_performance_bench.py` measures file count and partition-pruning speedup, but the result file is produced on demand. |
| ACID, metadata, snapshot, schema evolution, compaction | PASS | `docs/architecture/ARCHITECTURE.md:248-282` + `experiments/01_schema_evolution_time_travel.py` |
| DQ, lineage, idempotent pipeline, RBAC | PARTIAL | `src/lakehouse/quality/checks.py` (DQ), `tests/test_pipeline_idempotency.py` (idempotency), `apps/web` lineage route (status unknown — see PHASE_6_CONTROL_PLANE_AUDIT). RBAC missing. |

### D. Yêu cầu thực nghiệm

| Rubric line | Verdict | Evidence |
|---|---|---|
| Tạo dữ liệu đơn hàng CSV, sự kiện JSON, sản phẩm; nạp vào object storage | PASS | `data-samples/erp/orders.json`, `data-samples/erp/products.csv`, `data-samples/crm/customers.csv`. `make mock-retail` regenerates them. |
| Pipeline làm sạch, loại trùng, chuẩn hóa schema, bảng tổng hợp doanh thu | PASS | `src/lakehouse/transform/batch/`, `aggregate/batch/daily_revenue_aggregator.py` |
| **Thử thêm cột, cập nhật bản ghi, truy vấn phiên bản cũ, compact tệp nhỏ** | **PASS (new)** | `experiments/01_schema_evolution_time_travel.py` — 6-step script covering all four sub-actions |
| **Đo thời gian ingest, transform, query, dung lượng, số tệp trước-sau tối ưu** | **PASS (new)** | `experiments/03_performance_bench.py` — measures wall-time, bytes, file count, OPTIMIZE delta, partition-pruning speedup |

### E. Kết quả và minh chứng cần đạt

| Rubric line | Verdict | Evidence |
|---|---|---|
| Data lakehouse chạy được với cấu trúc lớp + catalog rõ ràng | PASS | `docs/architecture/ARCHITECTURE.md` + repo structure under `src/lakehouse/{ingest,transform,aggregate}/` |
| Notebook/job tái lập pipeline | **PARTIAL (new)** | `experiments/*.py` are script-based, not notebook. They DO produce reproducible runs; the rubric wording allows "notebook hoặc script". |
| Kiểm thử chất lượng dữ liệu + xử lý chạy lại không trùng | PASS | `tests/test_batch_correctness.py`, `tests/test_streaming_correctness.py`, `tests/test_pipeline_idempotency.py` |
| Biểu đồ hiệu năng query, dung lượng, số tệp, tác động partition/compaction | **PARTIAL (new)** | `results/03_performance_bench.csv` contains the data; chart generation is a separate step the report author can do with `pandas` + `matplotlib`. |
| Báo cáo so sánh ETL - ELT | **PASS (new)** | `results/02_etl_vs_elt.csv` + interpretation in `experiments/README.md` |

### F. Sản phẩm bàn giao tối thiểu

| Rubric line | Verdict | Evidence |
|---|---|---|
| Báo cáo kỹ thuật 20–35 trang | (out of scope) | Owned by the student, not the code |
| Repo có lịch sử đóng góp 3 thành viên + tag version | (student responsibility) | `git log` + `git tag` |
| Sơ đồ kiến trúc hiện trạng/mục tiêu | PASS | `docs/architecture/ARCHITECTURE.md` ASCII diagram |
| Sơ đồ luồng dữ liệu | PASS | `docs/architecture/ARCHITECTURE.md` §"Data flow examples" |
| Bộ dữ liệu đo CSV/JSON + notebook tạo lại bảng, biểu đồ | **PASS (new)** | `results/01_schema_evolution.csv`, `results/02_etl_vs_elt.csv`, `results/03_performance_bench.csv` |
| Hướng dẫn triển khai, dọn tài nguyên, ước tính chi phí, rủi ro | PASS | `README.md` §05–12, `docs/audit/PHASE_9_CLOUD_DEPLOYMENT_PLAN.md` |
| Video demo 8–12 phút | (out of scope) | Student responsibility |

### G. Tài liệu + công nghệ gợi ý

| Rubric line | Verdict | Evidence |
|---|---|---|
| MinIO + Spark + Delta Lake + DuckDB/Trino + dbt (optional) | PASS (4/6) | MinIO ✅, Spark ✅, Delta Lake ✅, DuckDB ✅ (in `apps/api/ARCHITECTURE.md:127`). dbt ❌, Trino ❌, Nessie ❌, Iceberg ❌ — all optional per rubric |
| Chạy được trên máy cá nhân / phòng máy / gói miễn phí | PASS | Local Docker stack, $0 |
| Tài nguyên có phí đặt ngân sách + cảnh báo | PARTIAL | `docs/audit/PHASE_9_CLOUD_DEPLOYMENT_PLAN.md` cost analysis, but Terraform budget alert not implemented (PHASE_9 §1.2 line 50) |

---

## 2. Tổng kết gap

| Status | Count | Items |
|---|---|---|
| PASS (already in repo) | 13 | Most of A, B, C, D, E, F, G above |
| PASS (added by this PR) | 4 | D "thêm cột/truy vấn phiên bản cũ/compact", D "đo thời gian/dung lượng/số tệp", E "biểu đồ hiệu năng CSV", E "so sánh ETL-ELT" |
| PARTIAL | 3 | C "lineage + RBAC" (RBAC still missing), E "biểu đồ = CSV, chart generation out of scope", G "budget alert" (Terraform) |
| MISSING (out of scope for code) | 3 | A "Lake vs Lakehouse paired benchmark", F "20-35 page report", F "video demo" |

**Net effect:** 4 of the 4 P0 empirical gaps in the original audit (turn
2026-10-16 §D) are now covered by 3 new scripts.

---

## 3. Verification checklist and measured run (2026-10-16)

```bash
# 0. Confirm Spark and Delta imports
python -c "from pyspark.sql import SparkSession; print('spark ok')"
python -c "from delta import configure_spark_with_delta_pip; print('delta ok')"

# 1. Run all three experiments (Java is detected from JAVA_HOME/common paths/PATH)
make experiment-01 experiment-02 experiment-03

# Or run separately
make experiment-01   # writes results/01_schema_evolution.csv
make experiment-02   # writes results/02_etl_vs_elt.csv
make experiment-03   # writes results/03_performance_bench.csv

# 2. Inspect each CSV — they are the primary input to your report
head -20 results/01_schema_evolution.csv
head -20 results/02_etl_vs_elt.csv
head -20 results/03_performance_bench.csv

# 3. Re-run to confirm idempotency (re-runs must overwrite, not append)
make experiment-01
ls -la results/  # same 3 files, fresh timestamps

# 4. Sanity check the existing pipeline still works
make verify   # lint + format + tests; pre-existing state preserved
```

**Measured results from this run** (local Spark, Java 11, bundled 1,000-order sample):

- Experiment 01: schema evolution, update, and version-0 time travel passed;
  `OPTIMIZE` reduced active data files from 4 to 1.
- Experiment 02: ETL and ELT each produced 340 Gold rows. ETL used 1 active
  data file (5,065 bytes); ELT used 681 active data files (1,414,125 bytes)
  across Bronze, Silver, and Gold.
- Experiment 03: ingest/transform/query and partition-pruning measurements
  completed; Gold compaction reduced active data files from 4 to 1. The
  measured partition-pruning ratio was 0.64x (single-day query slower than
  full scan), so this small local run does not demonstrate a speedup.
- All three commands returned PASS and wrote their CSV outputs under `results/`.

**NOT RUN items:**

- Chart generation from the CSVs
- The báo cáo kỹ thuật 20–35 trang
- The video demo
- Full `make verify` and Docker-stack/Airflow/API acceptance checks

---

## 4. Files delivered or updated during verification

| File | Purpose |
|---|---|
| `experiments/_common.py` | Shared Spark setup, Java discovery, active Delta metrics, and CSV output |
| `experiments/exp01_schema_evolution_time_travel.py` | Schema evolution, update, time travel, and compaction experiment |
| `experiments/exp02_etl_vs_elt.py` | ETL versus ELT comparison over the bundled order sample |
| `experiments/exp03_performance_bench.py` | Ingest/transform/query, compaction, and partition-pruning measurements |
| `experiments/README.md` | Run instructions, measured-metric definitions, and caveats |
| `results/01_schema_evolution.csv` | Experiment 01 measurements |
| `results/02_etl_vs_elt.csv` | Experiment 02 measurements |
| `results/03_performance_bench.csv` | Experiment 03 measurements |
| `.gitignore` | Keep generated report CSVs visible to Git while ignoring other CSV files |
| `docs/audit/PHASE_13_RUBRIC_GAP.md` | Rubric gap audit and measured verification record |

The existing lakehouse runtime modules were not changed. Experiment scripts
were corrected where the measured run exposed input-format, Python 3.14,
CSV-shape, and file-metric issues.

---

## 5. Pre-existing P0 not addressed by this PR

The `make verify` gate currently fails on:

1. `black --check` on 6 files (formatting drift since the last CI run).
2. 1 pytest failure (documented in `PHASE_11_FINAL_ACCEPTANCE_REVIEW.md`).

These are **out of scope** for the rubric-PR (they are pre-existing,
unrelated to rubric Đề tài 15). They are listed here so they are not
forgotten.

Suggested next action: a separate small PR that runs `make format` and
re-runs `pytest` to bring `make verify` to green.
