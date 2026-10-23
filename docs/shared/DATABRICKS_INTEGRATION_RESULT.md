# Databricks integration — cấu hình và bằng chứng

- **Motivation/Background**: Web trước đây chỉ đọc metadata Mongo/MinIO local nên không hiển thị dữ liệu Databricks đã có.
- **Purpose**: Kết nối dữ liệu thật qua backend, kiểm chứng bảng/schema/sample/history và ghi rõ giới hạn.
- **Overview Pipeline**: Audit contract → kiểm tra hai credential → adapter server → nối services/UI → unit/build → kiểm tra cloud/browser.
- **Detailed Plan**: A–J: nguyên nhân, cấu hình, thay đổi, dữ liệu, API, kiểm thử, browser, bảo vệ credential, giới hạn, trạng thái.
- **References**: [Kế hoạch](../plan/plan_to_refactor&fix/DATABRICKS_INTEGRATION.md), [Statement Execution API](https://docs.databricks.com/api/statement-execution/v1/statement-execution), [Unity Catalog Tables API](https://docs.databricks.com/api/uc-tables/v1/list-tables).
- **Created**: 2026-10-21T17:32:59+07:00
- **Last Updated**: 2026-10-21T17:32:59+07:00

---

[STATUS: COMPLETED] — VERIFIED PASS cho kết nối đọc dữ liệu Databricks và hiển thị web trong môi trường đã kiểm tra.

## A. Nguyên nhân và quyết định

Biến environment chưa đủ để kết nối: các [catalog services](../../apps/api/src/modules/catalog/services) dùng Mongo và [layer services](../../apps/api/src/modules/bronze/services/table.service.ts) dùng DuckDB/S3 local. Đã thêm provider Databricks rõ ràng, không seed dữ liệu giả hoặc sao chép bảng vào Mongo.

Hai credential được cung cấp có quyền khác nhau. Credential bổ sung liệt kê được metadata nhưng SQL thất bại với SQLSTATE 42501, thiếu USE SCHEMA trên workspace.bronze. Credential ban đầu đã thực thi SELECT thành công và được chọn làm credential hoạt động. Không thực hiện GRANT hoặc thay đổi ACL.

Đã sửa validator đọc bảng để nhận định danh ba phần, giữ nguyên catalog.schema.table; không đảo tên layer và catalog. Các schema ngoài medallion vẫn hiện trong Catalog.

## B. Cấu hình đang hoạt động

Đã cập nhật [environment root](../../.env) và [environment API](../../apps/api/.env.local), cả hai được Git ignore và giữ cùng credential. Next.js hiện đọc cấu hình chạy từ environment của API. Khi đổi token/config, cập nhật hai bản và khởi động lại API. Các [template root](../../.env.example) và [template API](../../apps/api/.env.example) chỉ có placeholder, mặc định local.

```dotenv
LAKEHOUSE_DATA_SOURCE=databricks
DATABRICKS_HOST=https://dbc-70e4e968-2b60.cloud.databricks.com
DATABRICKS_TOKEN=replace-with-rotated-token không ghi giá trị thật trong tài liệu>
DATABRICKS_WORKSPACE_ID=7474645199996868
DATABRICKS_WAREHOUSE_ID=affdbeeaeabd36ae
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/affdbeeaeabd36ae
DATABRICKS_CATALOG=workspace
DATABRICKS_BRONZE_SCHEMA=bronze
DATABRICKS_SILVER_SCHEMA=silver
DATABRICKS_GOLD_SCHEMA=gold
```

Host là HTTPS origin, không chứa query o=. HTTP path phải khớp warehouse ID. API sử dụng SQL Statement Execution REST theo warehouse ID; HTTP path được giữ để đối chiếu connection details, không cần JDBC driver. Catalog UUID trong ảnh không phải hostname/warehouse ID.

Nguồn local được giữ bằng LAKEHOUSE_DATA_SOURCE=local. Chế độ Databricks không tự fallback về dữ liệu local rỗng khi cloud lỗi.

## C. Thay đổi chính

- [Environment validation](../../apps/api/src/config/env.ts): source selection, kiểm tra origin và warehouse/path.
- [Client Databricks](../../apps/api/src/lib/infra/databricks/client.ts): bearer chỉ ở server, không theo redirect, timeout hữu hạn, quote/validate identifier, giữ BIGINT lớn dạng string, phân biệt lỗi quyền/timeout.
- [Repository Databricks](../../apps/api/src/modules/catalog/repositories/databricks.repository.ts): Unity Catalog pagination, cache metadata/count 60 giây, đọc count/detail/sample/history qua SQL; không lưu row content vào metadata local.
- [Catalog services](../../apps/api/src/modules/catalog/services) và [layer services](../../apps/api/src/modules): chọn provider cho read APIs; các action ghi local bị chặn khi đang xem Databricks.
- [Gold SQL service](../../apps/api/src/modules/gold-queries/services/queries.service.ts): ad-hoc SELECT qua warehouse, giữ SQL guard và giới hạn preview; không chạy trước thao tác submit.
- [Catalog UI](../../apps/web/src/screens/catalog/catalog.view.tsx): hiển thị native schema, hỗ trợ chọn bảng để xem schema, count, size và sample; trường chưa có dữ liệu hiện —.
- [Home aggregation](../../apps/web/src/services/queries/home.queries.ts): 13 bảng nghiệp vụ, module Bronze 3 / Silver 5 / Gold 3; loại information_schema khỏi KPI nghiệp vụ. Không lấy số dòng hiện có làm số records processed trong lịch sử.
- [Health](../../apps/api/src/modules/health/services/health.service.ts) và [source banner](../../apps/web/src/navigation/layout/layout.component.tsx): Databricks check và nguồn dữ liệu rõ ràng; credential không xuất hiện trong API info.
- [Drawer](../../apps/web/src/components/common/drawer.component.tsx)/[Modal](../../apps/web/src/components/common/modal.component.tsx): portal ra body để bảng/query không bị clipping bởi glass panel hoặc route transition. Có kiểm tra DOM và browser viewport.

SQL chạy bất đồng bộ rồi poll trạng thái để tránh hủy tại mốc wait ban đầu. Deadline đọc 25 giây, hủy query còn pending khi hết hạn; không để request chờ vô hạn. Mô hình async/poll là hành vi được hỗ trợ trong [Databricks Statement Execution API](https://docs.databricks.com/api/statement-execution/v1/statement-execution).

## D. Dữ liệu đã đọc trực tiếp

Bằng chứng [live JSON](../../test-results/databricks-live.json), hoàn tất lúc `2026-10-21T10:13:18.304Z`. [Script kiểm tra](../../scripts/verify-databricks.mjs) đọc count và một sample mỗi bảng, chỉ lưu tên bảng/số dòng/số sample, không ghi nội dung row vào log.

| Bảng nghiệp vụ | Số dòng tại kiểm tra | Sample được đọc |
|---|---:|---:|
| workspace.bronze.crawler_raw | 2,147 | 1 |
| workspace.bronze.customers_test | 10 | 1 |
| workspace.bronze.orders_test | 17 | 1 |
| workspace.gold.crawler_source_metrics | 21 | 1 |
| workspace.gold.customer_ltv_elt | 10 | 1 |
| workspace.gold.customer_ltv_etl | 10 | 1 |
| workspace.raw_elt.customers_raw | 10 | 1 |
| workspace.raw_elt.orders_raw | 17 | 1 |
| workspace.silver.crawler_records | 1,050 | 1 |
| workspace.silver.customers_clean_elt | 10 | 1 |
| workspace.silver.customers_clean_etl | 10 | 1 |
| workspace.silver.orders_enriched_elt | 17 | 1 |
| workspace.silver.orders_enriched_etl | 17 | 1 |

Tổng 13 bảng: Bronze 3, Silver 5, Gold 3, raw_elt 2. default có 0 bảng; information_schema có 29 metadata objects và vẫn truy cập được từ Catalog. Đây là snapshot, dữ liệu trên workspace có thể thay đổi sau đó. Không cộng các bản ETL/ELT/layer thành số bản ghi duy nhất.

## E. API và hành vi đã xác minh

Frontend → API local → Unity Catalog REST/SQL warehouse → bảng Databricks. Token không đi qua trình duyệt.

| Nhóm | Kết quả thật |
|---|---|
| info / catalog health | source=databricks, readOnly=true, catalog=workspace |
| catalog/databases | 6 schema; số bảng từng schema lấy từ Unity Catalog |
| catalog/tables, database table list | Native IDs, không giả layer cho raw_elt/information_schema |
| catalog table/schema/sample/stats | Đọc bảng thật, schema đúng, sample có dữ liệu |
| bronze/silver/gold list/detail/sample/stats | Danh sách thật, row count và size thực của các bảng đã kiểm tra |
| layer history | Đọc DESCRIBE HISTORY; operation giữ nguyên, không giả định WRITE |
| gold queries/ad-hoc | SELECT COUNT trên workspace.bronze.orders_test chạy từ web |
| deep health | Databricks up tại lần kiểm tra; không đồng nghĩa ETL đã được agent chạy |

## F. Kiểm thử

Codex chạy local ngày 2026-10-21 với API build cổng 3001 và Chrome thật qua web test cổng 5174. Test cloud dùng workspace của người dùng, không dùng fixture để báo kết nối thật.

| Lệnh/nhóm | Kết quả | Bằng chứng |
|---|---|---|
| pnpm test | API 73 + web 89 = **162 PASS** | [unit log](../../test-results/databricks-unit-tests.log) |
| pnpm --filter lakehouse-api typecheck | PASS | [API types](../../test-results/databricks-api-typecheck.log) |
| pnpm --filter @lakehouse/web typecheck | PASS | [web types](../../test-results/databricks-web-typecheck.log) |
| pnpm --filter lakehouse-api build | PASS | [API build](../../test-results/databricks-api-build.log) |
| pnpm --filter @lakehouse/web build | PASS | [web build](../../test-results/databricks-web-build.log) |
| pnpm --filter lakehouse-api lint | PASS; 7 console warnings có sẵn | [lint](../../test-results/databricks-api-lint.log) |
| FULL_VERIFY=1 node scripts/verify-databricks.mjs | **13/13 bảng** count + sample, không có failure | [live log](../../test-results/databricks-live.log) |
| DATABRICKS_E2E=1 pnpm --filter @lakehouse/web test:e2e | **36/36 PASS**, 0 skipped/flaky | [browser log](../../test-results/databricks-browser.log), [JSON](../../test-results/browser-results.json) |
| git diff --check và quét token trong source/bundle | PASS | kiểm tra trực tiếp local |

Các test mới kiểm tra identifier injection, auth/SQL permission, token không theo redirect, failed/pending SQL, bigint, truncated result, pagination, null metadata, system/business counts và portal overlays. Test fixture chỉ nằm trong test.

Warning không chặn build: bundle web lớn, PostCSS/Vite/Node warnings đã quan sát trước đó. Python không thay đổi trong nhiệm vụ này; môi trường pytest/ruff chưa cài từ đợt audit trước nên không tuyên bố hồi quy Python đã được chạy thành công.

## G. Ảnh giao diện đã xem

- [Home EN](../../test-results/browser/screens-home-renders-en-against-the-live-API/home-en.png)
- [Home VI](../../test-results/browser/screens-home-renders-vi-against-the-live-API/home-vi.png)
- [Catalog: schema, count và dữ liệu orders_test](../../test-results/browser/databricks-Live-Databricks-a21fa-ma-and-rows-from-Databricks/catalog-databricks.png)
- [Bronze sample](../../test-results/browser/databricks-Live-Databricks-ca0f8-plays-real-rows-and-history/bronze-sample-databricks.png)
- [Silver sample](../../test-results/browser/databricks-Live-Databricks-e8c00-plays-real-rows-and-history/silver-sample-databricks.png)
- [Gold sample](../../test-results/browser/databricks-Live-Databricks-27d1f-plays-real-rows-and-history/gold-sample-databricks.png)
- [SQL trên warehouse](../../test-results/browser/databricks-Live-Databricks-41fc1-st-the-Databricks-warehouse/databricks-sql.png)

Lượt browser cuối chạy lúc `2026-10-21T10:19:50.750Z`, gồm 22 màn desktop EN/VI, 3 mobile, 6 tương tác hồi quy và 5 kiểm tra Databricks thật. Đã kiểm tra trực quan Home hiển thị 13 và Catalog drawer đầy viewport, có 17 dòng cùng sample của orders_test.

Ảnh/log ở ignored test-results, tồn tại trong workspace này. Chạy lại các script/test để tạo bằng chứng trên clone khác. Browser suite Databricks được bật rõ bằng DATABRICKS_E2E=1; mặc định không gọi workspace từ test cloud.

## H. Bảo vệ credential và dữ liệu

Credential được chọn sau khi kiểm tra quyền SELECT; giá trị không có trong source, template, bundle web hoặc báo cáo. File environment private được Git ignore. Không thay đổi grants, ACL, kích thước warehouse hay chính sách auto-stop.

Không thực hiện INSERT/UPDATE/DELETE, tạo bảng, ingest, crawl, produce, transform, aggregate, suite hoặc trigger job/DAG. Các SQL count/sample/detail/history là đọc trên dữ liệu hiện có. Không đẩy row từ Databricks vào Mongo/MinIO.

## I. Phạm vi chưa kết nối

Kết nối này hỗ trợ **browsing và SELECT**. Các worker/ETL ghi dữ liệu, job history local, Kafka, Airflow, DQ vẫn là các dịch vụ riêng; không biến chúng thành Databricks Jobs bằng một token. Canned SQL local, lineage inference local, Silver diff/time travel và partition-value metrics chưa có adapter remote; trả lỗi hỗ trợ rõ thay vì đọc nhầm storage local hoặc giả kết quả. Views/non-Delta không có Delta history.

Khi warehouse cần khởi động hoặc query vượt deadline, API báo timeout và cho phép retry; không báo count=0. Metadata/count cache 60 giây; sample là bounded preview. Chưa deploy cloud/public API, chưa triển khai writer hoặc chạy pipeline thực trên Databricks. Các giới hạn pipeline/storage local trong [audit trước](AUDIT_FULL_STACK_RECOVERY.md) không được coi là đã giải quyết chỉ nhờ kết nối đọc này.

## J. Trạng thái và vận hành

**VERIFIED PASS** cho source Databricks → API → web, 13 bảng nghiệp vụ đọc được và 11 màn hình trong browser suite. API local đã được khởi động với cấu hình mới; refresh web để bỏ cache frontend cũ.

Dùng [dev API script](../../scripts/dev-api.sh) hoặc build/start theo scripts trong [API manifest](../../apps/api/package.json). Web dùng [dev script](../../scripts/dev-web.sh). Khi thay đổi credential, khởi động lại API. Không đưa token vào VITE hoặc browser localStorage.

Không commit, merge hay deploy trong nhiệm vụ này. Các thay đổi có sẵn của người dùng, gồm background/logo và environment/template trước đó, được giữ nguyên.
