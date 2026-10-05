# 04 – Data Governance trong Data Lake

## 1. Khái niệm

**Data Governance** = tập hợp policies, processes, technology để đảm bảo data **chất lượng cao**, **bảo mật**, **tuân thủ quy định**, và **có giá trị** cho tổ chức.

## 2. 4 Trụ cột

```
         Data Governance
              │
    ┌─────────┼─────────┐
    │         │         │
  Data      Data      Data       Data
 Quality  Security  Privacy   Lifecycle
```

## 3. Data Quality

### 3.1. Các chiều chất lượng

| Chiều | Mô tả | Ví dụ |
|-------|-------|-------|
| **Accuracy** | Đúng sự thật | email thật, giá đúng |
| **Completeness** | Không thiếu field | customer_id NOT NULL |
| **Consistency** | Khớp giữa các hệ thống | CRM và ERP cùng customer_id |
| **Timeliness** | Cập nhật đúng lúc | order_date = ngày đặt hàng |
| **Validity** | Đúng format/rule | email có @, age 0-120 |
| **Uniqueness** | Không trùng lặp | order_id unique |
| **Integrity** | Referential OK | customer_id tồn tại trong dim |

### 3.2. Tools
- **Great Expectations**: Python-based, dễ dùng
- **Deequ** (AWS): Spark-based
- **Soda Core**: YAML-based checks
- **dbt tests**: SQL-based

### 3.3. Code mẫu với Great Expectations

```python
import great_expectations as ge

df_ge = ge.dataset.SparkDFDataset(df_silver)

# Check 1: Not null
df_ge.expect_column_values_to_not_be_null("customer_id")

# Check 2: Unique
df_ge.expect_column_values_to_be_unique("order_id")

# Check 3: Range
df_ge.expect_column_values_to_be_between("age", 0, 120)

# Check 4: In set
df_ge.expect_column_values_to_be_in_set("status",
    ["pending", "paid", "shipped", "delivered", "cancelled"])
```

## 4. Data Security

### 4.1. Layers

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

### 4.2. Best practices
- ✅ **Principle of least privilege**: Chỉ cấp quyền tối thiểu
- ✅ **Secrets management**: Dùng Vault, AWS Secrets Manager
- ✅ **PII detection**: Tự động phát hiện dữ liệu nhạy cảm
- ✅ **Audit logs**: Log mọi access

## 5. Data Privacy (GDPR, Nghị định 13/2023 VN)

### 5.1. Quyền của chủ thể dữ liệu
1. **Quyền được biết**: Biết data được thu thập
2. **Quyền đồng ý**: Consent trước khi thu thập
3. **Quyền truy cập**: Xem data của mình
4. **Quyền sửa**: Sửa data sai
5. **Quyền xóa**: "Right to be forgotten"
6. **Quyền hạn chế**: Giới hạn xử lý
7. **Quyền di chuyển**: Export data

### 5.2. Implementation
- ✅ Data minimization: Chỉ thu thập cần thiết
- ✅ Retention policy: Xóa data hết hạn
- ✅ Consent management
- ✅ Data lineage: Track nguồn gốc

## 6. Data Lifecycle

```
Create → Store → Use → Archive → Delete
  │         │      │        │         │
  Day 0   0-2y   Active   2-7y    7y+
                            │
                       Cold storage
                       (Glacier, ADLS Archive)
```

### Retention policy trong project
- **Bronze**: 7 năm (audit, reprocess)
- **Silver**: 2 năm
- **Gold**: 1 năm (tùy use case)
- **Backup**: Daily snapshot, giữ 30 ngày

## 7. Data Lineage

Track **flow** của data từ source → consumer:

```
CRM DB → Bronze (crm/customers) → Silver (customers) → Gold (dim_customers) → BI Dashboard
   │              │                      │                       │                    │
source         raw                cleaned              enriched              visualized
```

### Tools
- **Apache Atlas**
- **DataHub** (LinkedIn)
- **Amundsen** (Lyft)
- **OpenLineage**

## 8. Data Catalog

Cho phép **discover**, **understand**, **govern** data:

- ✅ Metadata: Schema, owner, refresh time
- ✅ Business glossary
- ✅ Search & browse
- ✅ Data profiling
- ✅ Access requests

### Tools
- Apache Hive Metastore
- AWS Glue Catalog
- DataHub
- Amundsen

## 9. Compliance

| Quy định | Region | Áp dụng |
|----------|--------|---------|
| GDPR | EU | Data công dân EU |
| CCPA | California | Data công dân CA |
| PDPA | Singapore/Thailand | Data cá nhân |
| Nghị định 13/2023 | VN | Data cá nhân VN |
| HIPAA | US | Healthcare |
| PCI DSS | Global | Payment data |

## 10. Kết luận

Data Governance không phải "nice to have" mà là **must have**. Trong project này:
- ✅ Data Quality: Manual checks ở Silver
- ✅ Security: MinIO với access key
- ✅ Privacy: Không crawl PII
- ✅ Lifecycle: Delta Lake Time Travel
