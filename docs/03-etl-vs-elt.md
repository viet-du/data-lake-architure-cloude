# 03 – ETL vs ELT: So sánh chi tiết

## 1. Khái niệm

### ETL (Extract, Transform, Load)
```
Extract → Transform → Load
   ↓         ↓          ↓
 Source   Transform   Target
```
- Transform **trước khi** load
- Target là Data Warehouse (schema-on-write)
- Phù hợp: Data ít, cần transform phức tạp

### ELT (Extract, Load, Transform)
```
Extract → Load → Transform
   ↓         ↓          ↓
 Source   Raw     Transform
            (Lake)
```
- Transform **sau khi** load
- Target là Data Lake (schema-on-read)
- Phù hợp: Data lớn, cần linh hoạt

## 2. So sánh

| Tiêu chí | ETL | ELT |
|----------|-----|-----|
| Transform | Trước load (engine riêng) | Sau load (SQL/Spark trong lake) |
| Storage | Warehouse (expensive) | Lake (cheap) |
| Schema | Schema-on-write | Schema-on-read |
| Data volume | GB - TB | TB - PB |
| Latency | Chậm (transform lâu) | Nhanh (load raw) |
| Flexibility | Thấp (phải define schema) | Cao (raw giữ nguyên) |
| Cost | $$ (transform engine) | $ (chỉ storage) |
| Use case | BI truyền thống | Modern data stack |

## 3. ELT trong project này

Project dùng **ELT** (Bronze → Silver → Gold), phù hợp với Data Lake:

```
Extract: Read CSV/JSON/Kafka
   ↓
Load: Ghi raw vào Bronze (s3a://bronze/)
   ↓
Transform: Spark SQL xử lý trong lake
   ↓
   ├─► Silver (s3a://silver/) - cleaned
   └─► Gold (s3a://gold/) - business KPIs
```

## 4. Khi nào dùng cái nào?

### Dùng ETL khi:
- ✅ Data warehouse truyền thống (Snowflake, Redshift, BigQuery)
- ✅ Cần transform phức tạp (ML preprocessing)
- ✅ Compliance yêu cầu clean data trước khi lưu
- ✅ Data ít (GB), latency không quan trọng

### Dùng ELT khi:
- ✅ Data lake + Delta Lake
- ✅ Cần giữ raw data (audit, reprocess)
- ✅ Data lớn (TB+)
- ✅ Nhiều use case từ cùng 1 nguồn
- ✅ Modern data stack (dbt, Spark SQL)

## 5. Hybrid approach

Trong thực tế, nhiều project dùng **hybrid**:
- ETL cho **streaming** (transform trước khi ghi lake)
- ELT cho **batch** (load raw, transform sau)

## 6. Tools phổ biến

| ETL Tools | ELT Tools |
|-----------|-----------|
| Informatica | dbt |
| Talend | Spark SQL |
| Apache NiFi | Snowflake |
| AWS Glue | BigQuery |
| Azure Data Factory | Databricks |
