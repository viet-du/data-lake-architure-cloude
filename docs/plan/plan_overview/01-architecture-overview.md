

**Data Lake** là kho lưu trữ tập trung cho phép lưu trữ **mọi loại dữ liệu** (structured, semi-structured, unstructured) ở **mọi quy mô** mà không cần định nghĩa schema trước.


| Tiêu chí | Data Warehouse | Data Lake |
|----------|---------------|-----------|
| **Data** | Structured, cleaned | Any format (raw) |
| **Schema** | Schema-on-write | Schema-on-read |
| **Storage** | Expensive (columnar) | Cheap (object storage) |
| **Use case** | BI, reporting | BI + ML + Streaming |
| **User** | Business analyst | Data engineer + analyst + scientist |
| **Cost** | $$$ | $ |


```
┌─────────────────────────────────────────────────────────────┐
│                    Data Lake Architecture                    │
│                                                              │
│  SOURCES            INGEST         PROCESS        SERVE      │
│  ┌──────┐          ┌──────┐       ┌──────┐      ┌──────┐   │
│  │ DB   │ ──────► │Bronze │ ────► │Silver │ ──► │ Gold │   │
│  │ File │          │ Raw   │       │Clean  │      │Curate│   │
│  │ API  │          └──────┘       └──────┘      └──┬───┘   │
│  │ IoT  │                                            │       │
│  │Kafka │                                            ▼       │
│  └──────┘                                       ┌────────┐   │
│                                                │   BI   │   │
│  STORAGE: MinIO / S3 / GCS / ADLS              │   ML   │   │
│  COMPUTE: Spark / Flink                        │ Report │   │
│  ORCHESTRATION: Airflow                        └────────┘   │
└─────────────────────────────────────────────────────────────┘
```


- **MinIO**: S3-compatible, self-hosted (Docker)
- **AWS S3 / GCS / ADLS**: Cloud equivalents
- **Delta Lake**: ACID transactions trên data lake

- **Apache Spark**: Batch + Streaming
- **PySpark / Scala**: Ngôn ngữ lập trình
- **Delta Lake**: Transactional layer

- **Apache Airflow**: DAG scheduling
- **DAGs**: Chuỗi task tự động

- **Metabase / Superset**: Open-source BI
- **Looker / Power BI**: Enterprise BI
- **Jupyter**: Data science


```
 BRONZE (Raw)
   • Append-only
   • Schema không enforce
   • Partition theo ingestion_date
   • Retention lâu dài

   ↓  Clean, validate, dedup

 SILVER (Cleaned)
   • Conformed schema
   • Data Quality checks
   • Business keys chuẩn hóa
   • Dùng cho analysis

   ↓  Aggregate, business logic

 GOLD (Curated)
   • Star schema (fact + dim)
   • Business KPIs
   • Optimized cho BI
   • Có thể expose API
```

Xem chi tiết tại [`02-medallion-architecture.md`](02-medallion-architecture.md).


| Component | Tool | Why? |
|-----------|------|------|
| Storage | **MinIO** | Free, S3-compatible, self-hosted |
| Lake Format | **Delta Lake** | ACID, time travel, schema evolution |
| Compute | **Spark 3.4** | Batch + Stream trong 1 framework |
| Streaming | **Kafka** | Industry standard, durable |
| Orchestration | **Airflow 2.7** | Phổ biến nhất, Python DAGs |
| BI | **Metabase** | Open-source, dễ dùng |
| Language | **Python 3.11** | Phổ biến, ecosystem lớn |


| Aspect | Lambda (project này) | Kappa |
|--------|---------------------|-------|
| Pipeline | Batch + Stream | Stream only |
| Storage | Lake (3 layers) | Kafka (event log) |
| Reprocess | Batch job | Replay Kafka |
| Complexity | Higher | Lower |
| Use case | Hybrid (BI + realtime) | 100% realtime |

Project này dùng **Lambda** - phù hợp cho hầu hết use case thực tế.


1.  **Business Intelligence**: Báo cáo doanh thu, dashboard
2.  **Machine Learning**: Training data, feature store
3.  **Search & Analytics**: Full-text search, log analysis
4.  **Real-time Analytics**: Stream processing, alerting
5.  **Data Governance**: Audit, compliance, lineage
6.  **Data Science**: Exploratory analysis, experimentation


 **Đặt tên rõ ràng**: `s3a://bronze/crm/customers/ingestion_date=2024-10-05/`
 **Partition**: Theo date để query nhanh hơn
 **Schema evolution**: Dùng Delta Lake auto-merge
 **Data Quality**: Check ở Silver layer
 **Idempotent**: Job chạy lại cho cùng kết quả
 **Monitoring**: Alerts khi pipeline fail
 **Documentation**: Mô tả schema, business logic


Data Lake là nền tảng cho mọi data-driven organization. Với Medallion Architecture + Delta Lake, bạn có:
-  Reliability (ACID)
-  Scalability (Spark + Object Storage)
-  Flexibility (any format, any schema)
-  Cost-efficiency (cheap storage)
-  Time travel (audit + rollback)
