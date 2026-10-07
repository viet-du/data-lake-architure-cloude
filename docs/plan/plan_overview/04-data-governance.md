

**Data Governance** = tập hợp policies, processes, technology để đảm bảo data **chất lượng cao**, **bảo mật**, **tuân thủ quy định**, và **có giá trị** cho tổ chức.


```
         Data Governance
              │
    ┌─────────┼─────────┐
    │         │         │
  Data      Data      Data       Data
 Quality  Security  Privacy   Lifecycle
```



| Chiều | Mô tả | Ví dụ |
|-------|-------|-------|
| **Accuracy** | Đúng sự thật | email thật, giá đúng |
| **Completeness** | Không thiếu field | customer_id NOT NULL |
| **Consistency** | Khớp giữa các hệ thống | CRM và ERP cùng customer_id |
| **Timeliness** | Cập nhật đúng lúc | order_date = ngày đặt hàng |
| **Validity** | Đúng format/rule | email có @, age 0-120 |
| **Uniqueness** | Không trùng lặp | order_id unique |
| **Integrity** | Referential OK | customer_id tồn tại trong dim |

- **Great Expectations**: Python-based, dễ dùng
- **Deequ** (AWS): Spark-based
- **Soda Core**: YAML-based checks
- **dbt tests**: SQL-based


```python
import great_expectations as ge

df_ge = ge.dataset.SparkDFDataset(df_silver)

df_ge.expect_column_values_to_not_be_null("customer_id")

df_ge.expect_column_values_to_be_unique("order_id")

df_ge.expect_column_values_to_be_between("age", 0, 120)

df_ge.expect_column_values_to_be_in_set("status",
    ["pending", "paid", "shipped", "delivered", "cancelled"])
```



| Layer | Bảo vệ |
|-------|--------|
| **Network** | VPC, firewall, private endpoint |
| **Authentication** | OAuth, JWT, LDAP, SSO |
| **Authorization** | RBAC, ACL, IAM |
| **Encryption at rest** | AES-256 (S3, GCS) |
| **Encryption in transit** | TLS 1.2+ |
| **Auditing** | CloudTrail, access logs |
| **Data masking** | PII redaction, hashing |
| **Row-level security** | Filter theo role |

-  **Principle of least privilege**: Chỉ cấp quyền tối thiểu
-  **Secrets management**: Dùng Vault, AWS Secrets Manager
-  **PII detection**: Tự động phát hiện dữ liệu nhạy cảm
-  **Audit logs**: Log mọi access


1. **Quyền được biết**: Biết data được thu thập
2. **Quyền đồng ý**: Consent trước khi thu thập
3. **Quyền truy cập**: Xem data của mình
4. **Quyền sửa**: Sửa data sai
5. **Quyền xóa**: "Right to be forgotten"
6. **Quyền hạn chế**: Giới hạn xử lý
7. **Quyền di chuyển**: Export data

-  Data minimization: Chỉ thu thập cần thiết
-  Retention policy: Xóa data hết hạn
-  Consent management
-  Data lineage: Track nguồn gốc


```
Create → Store → Use → Archive → Delete
  │         │      │        │         │
  Day 0   0-2y   Active   2-7y    7y+
                            │
                       Cold storage
                       (Glacier, ADLS Archive)
```

- **Bronze**: 7 năm (audit, reprocess)
- **Silver**: 2 năm
- **Gold**: 1 năm (tùy use case)
- **Backup**: Daily snapshot, giữ 30 ngày


Track **flow** của data từ source → consumer:

```
CRM DB → Bronze (crm/customers) → Silver (customers) → Gold (dim_customers) → BI Dashboard
   │              │                      │                       │                    │
source         raw                cleaned              enriched              visualized
```

- **Apache Atlas**
- **DataHub** (LinkedIn)
- **Amundsen** (Lyft)
- **OpenLineage**


Cho phép **discover**, **understand**, **govern** data:

-  Metadata: Schema, owner, refresh time
-  Business glossary
-  Search & browse
-  Data profiling
-  Access requests

- Apache Hive Metastore
- AWS Glue Catalog
- DataHub
- Amundsen


| Quy định | Region | Áp dụng |
|----------|--------|---------|
| GDPR | EU | Data công dân EU |
| CCPA | California | Data công dân CA |
| PDPA | Singapore/Thailand | Data cá nhân |
| Nghị định 13/2023 | VN | Data cá nhân VN |
| HIPAA | US | Healthcare |
| PCI DSS | Global | Payment data |


Data Governance không phải "nice to have" mà là **must have**. Trong project này:
-  Data Quality: Manual checks ở Silver
-  Security: MinIO với access key
-  Privacy: Không crawl PII
-  Lifecycle: Delta Lake Time Travel
