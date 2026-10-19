# Databricks Bridge — Python 3.14 Fix

**Ngày:** 2026-10-19
**Vấn đề:** `databricks-connect==15.4.5` không tương thích Python 3.14

## Root cause

| # | Lỗi | Nguyên nhân |
|---|------|-------------|
| 1 | `zsh: no matches found: databricks-connect==15.4.*` | zsh glob `*` trong unquoted arg |
| 2 | `ImportError: pyarrow requires NumPy 2.0 or newer, found 1.26.4` | pyarrow 17.x cần numpy 2.0+ |
| 3 | `ModuleNotFoundError: No module named 'distutils'` | **Python 3.14 đã xóa `distutils` (PEP 632)**; `pyspark<4.0` vẫn dùng `distutils.version.LooseVersion` |
| 4 | `pip install setuptools` (84.0.0) không khắc phục được | setuptools ≥ 60 cũng đã **xóa distutils shim** |

## Quyết định

Bypass hoàn toàn `databricks-connect` CLI trên Python 3.14. Có 2 lựa chọn:

| Cách | Ưu | Nhược |
|------|-----|------|
| A. **Patch pyspark 3.5** để dùng `packaging.version` thay `distutils` | Không cần downgrade Python | Hacky, có thể break lúc khác |
| B. **Bypass CLI**, dùng `databricks-sdk` (REST API) cho job submission, config thẳng `~/.databrickscfg` | Sạch, official, hoạt động mọi Python | Không có local `SparkSession` interactive; phải submit job |

→ **Chọn B**: Sạch hơn, chính thức từ Databricks, không hack.

## Đã làm

### 1. `scripts/configure_databricks.py` (MỚI)

Viết `~/.databrickscfg` thẳng, không cần CLI:

```bash
python scripts/configure_databricks.py --write \
    --host https://community.cloud.databricks.com \
    --token dapi... \
    --cluster 0123-456789-abcdefgh
```

Verify:
```bash
python scripts/configure_databricks.py
```

### 2. `src/lakehouse/core/databricks_bridge.py` (REWRITE)

- `remote_spark()` — thử `databricks.connect` trước, fallback sang `databricks.sdk` REST nếu không import được (Python 3.14 case).
- `run_notebook()` — dùng `databricks.sdk` JobsAPI (không cần pyspark).
- `is_configured()` — chỉ check `~/.databrickscfg`, không cần CLI.
- `smoke_test()` — friendly error message khi thiếu config.

### 3. `scripts/run_pipeline_remote.py` (UPDATE)

- Đổi message hướng dẫn: dùng `databricks-sdk` thay `databricks-connect` trên Python 3.14.

## Cấu hình cần

Tôi cần 3 thông tin (paste dưới đây, tôi sẽ generate `~/.databrickscfg`):

| Field | Example | Của bạn |
|-------|---------|---------|
| host | `https://community.cloud.databricks.com` | `<paste>` |
| token | `dapi...` | `<paste>` |
| cluster_id | `0123-456789-abcdefgh` | `<paste>` |

## Hành động tiếp theo (sau khi có token)

```bash
# 1. Install SDK (pure-Python, không cần pyspark, không cần distutils)
pip install databricks-sdk

# 2. Cấu hình bằng script bypass
python scripts/configure_databricks.py --write \
    --host <your_host> --token <your_token> --cluster <cluster_id>

# 3. Smoke test
python scripts/run_pipeline_remote.py --smoke-test
```
