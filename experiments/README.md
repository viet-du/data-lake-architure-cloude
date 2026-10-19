# Experiments — Rubric Đề tài 15

This directory contains **3 reproducible experiments** that address the
empirical requirements of rubric Đề tài 15 ("Xây dựng data lakehouse
cho dữ liệu bán hàng bằng quy trình ETL và ELT").

The experiments are intentionally **Docker-free** — they write Delta
tables to `./_experiments_workspace/` on the local filesystem, so they
can be re-run on any laptop with Python 3.10+ and Java 11+.

## Why a separate workspace?

The main `make pipeline-batch` writes to MinIO inside the Docker stack.
These experiments are designed for the report:

- They do not require the Docker stack to be up.
- Each run resets only its own subdirectory (see `reset_workspace` in
  `_common.py`), preserving the demo and other experiments.
- They share the same Delta + Spark package versions as the rest of
  the repo (imported from `src/lakehouse/core/constants.py`).

## Running

```bash
# All three
make experiment-01   # schema evolution, time travel, OPTIMIZE
make experiment-02   # ETL vs ELT comparison
make experiment-03   # ingest / transform / query / OPTIMIZE / partition pruning

# Or directly
python -m experiments.exp01_schema_evolution_time_travel
python -m experiments.exp02_etl_vs_elt
python -m experiments.exp03_performance_bench
```

## Output

Each experiment writes its measurements to `results/<name>.csv` at the
repo root. The CSVs are the **primary input** to the báo cáo kỹ thuật
(rubric line "Bộ dữ liệu đo dạng CSV/JSON và notebook hoặc script
tạo lại bảng, biểu đồ").

## Rubric mapping

| Rubric line | Experiment |
|---|---|
| "Thử thêm cột, cập nhật bản ghi, truy vấn phiên bản cũ và compact tệp nhỏ" | `01_schema_evolution_time_travel.py` |
| "So sánh ETL và ELT trên cùng một yêu cầu làm sạch và tổng hợp" | `02_etl_vs_elt.py` |
| "Đo thời gian ingest, transform, query, dung lượng và số tệp trước-sau tối ưu" | `03_performance_bench.py` |
| "Data lakehouse cải thiện... so với thư mục data lake không có lớp giao dịch" | See `docs/audit/PHASE_13_RUBRIC_GAP.md` (literature-based, not benchmark) |

## Caveats

- Single-machine Spark (`local[2]`) — absolute timings and ratios are
  workload- and machine-dependent. The small sample may show no benefit
  from partition pruning; report the measured value rather than assuming
  a speedup.
- File-count and byte metrics use active Delta data files and exclude
  transaction logs and files removed from the current table snapshot.
- Experiment 03 deliberately writes four small Gold files before
  `OPTIMIZE` so the compaction effect can be measured.
- `02_etl_vs_elt.py` applies the same cleaning function and Gold aggregation
  to both paths. ETL transforms before its first Delta write and persists
  Silver + Gold; ELT first persists unchanged source rows to Bronze, then
  persists the same Silver + Gold outputs. It checks Gold parity with a
  bidirectional `EXCEPT ALL` comparison and records a source SHA-256.
- The current experiment keeps every status, including cancelled/refunded,
  while requiring a valid order ID/date and positive total amount. This is an
  explicit experiment rule; change it only after the project's revenue policy
  is agreed. Total storage is measured across persisted active Delta data
  files and therefore includes Bronze for ELT but not ETL.
- All scripts are idempotent: each run resets only its own experiment
  directory and overwrites its corresponding CSV in `results/`.
