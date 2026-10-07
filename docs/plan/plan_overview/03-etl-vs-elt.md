

```
Extract → Transform → Load
   ↓         ↓          ↓
 Source   Transform   Target
```
- Transform **trước khi** load
- Target là Data Warehouse (schema-on-write)
- Phù hợp: Data ít, cần transform phức tạp

```
Extract → Load → Transform
   ↓         ↓          ↓
 Source   Raw     Transform
            (Lake)
```
- Transform **sau khi** load
- Target là Data Lake (schema-on-read)
- Phù hợp: Data lớn, cần linh hoạt


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


-  Data warehouse truyền thống (Snowflake, Redshift, BigQuery)
-  Cần transform phức tạp (ML preprocessing)
-  Compliance yêu cầu clean data trước khi lưu
-  Data ít (GB), latency không quan trọng

-  Data lake + Delta Lake
-  Cần giữ raw data (audit, reprocess)
-  Data lớn (TB+)
-  Nhiều use case từ cùng 1 nguồn
-  Modern data stack (dbt, Spark SQL)


Trong thực tế, nhiều project dùng **hybrid**:
- ETL cho **streaming** (transform trước khi ghi lake)
- ELT cho **batch** (load raw, transform sau)


| ETL Tools | ELT Tools |
|-----------|-----------|
| Informatica | dbt |
| Talend | Spark SQL |
| Apache NiFi | Snowflake |
| AWS Glue | BigQuery |
| Azure Data Factory | Databricks |
