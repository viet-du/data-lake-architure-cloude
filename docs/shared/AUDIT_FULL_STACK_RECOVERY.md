# Full-stack recovery — evidence and remaining work

- **Motivation/Background**: Khôi phục i18n và kết nối của 11 màn hình Data Lake theo master prompt.
- **Purpose**: Ghi nhận thay đổi, bằng chứng kiểm tra và giới hạn thực tế.
- **Overview Pipeline**: Audit → plan → sửa tuần tự → contract tests → build → API thật → Chrome.
- **Detailed Plan**: A–J: nguyên nhân, thay đổi, i18n, API, màn hình, test, browser, hồi quy, rủi ro, trạng thái.
- **References**: [Kế hoạch](../plan/plan_to_refactor&fix/FULL_STACK_RECOVERY.md), [kiến trúc](../architecture/ARCHITECTURE.md), [quy tắc audit](../../.agents/rules/CODEBASE_AUDIT.md).
- **Created**: 2026-10-21T08:20:13+07:00
- **Last Updated**: 2026-10-21T17:32:59+07:00

---

[STATUS: ACTIVE] — PARTIALLY VERIFIED cho toàn nền tảng; xem mục J để phân biệt phạm vi đã kiểm chứng.

## A. Root Causes Found

| Nguyên nhân đầu tiên | Phạm vi | Kết quả |
|---|---|---|
| Resource EN/VI thiếu nhóm screens, home.stats, schematic và shared labels | 11 màn hình | Đã bổ sung và có kiểm tra key/source/parity |
| Script dev tính sai thư mục; API URL/CORS chưa khớp Vite | Toàn bộ request | Sửa launcher, proxy relative và allowlist CORS |
| UI và API khác envelope, tên trường, định danh db.table, trạng thái và đơn vị thời gian | Catalog/layers/crawler/Kafka/Airflow/DQ | Adapter Zod tại service boundary |
| Dashboard chuyển request lỗi thành 0; activity/trend cứng; DQ không có run vẫn 100% | Home/DQ | Unknown hiển thị —; bỏ số liệu giả; giữ 0 thật |
| Health không đặt tên dịch vụ, skipped bị hiểu healthy, uptime milliseconds | Home/Health | Phân biệt API availability và dependency readiness; ms → s |
| DuckDB endpoint bị ghép lặp scheme; glob thiếu cấp database | Bronze/Silver/Gold | Sửa cấu hình endpoint và đường dẫn listing |
| Kafka repository bỏ qua biến bootstrap đã cấu hình; broker quảng bá địa chỉ không dùng được từ host | Kafka | Đọc đúng bootstrap; tách listener host/container |
| ioredis keyPrefix không tương thích BullMQ; ba Bronze worker cùng queue bỏ qua job khác kind | Các queue/Bronze | Prefix ở Queue/Worker; dispatcher chung, lỗi executor không thành completed |
| Airflow Fernet key không hợp lệ; init lỗi bị nuốt; API statistics không tồn tại | Airflow | Key local hợp lệ, init fail rõ; dùng API có trong OpenAPI local |
| API ES2017 không biên dịch BigInt; dependency/lockfile thiếu API và lệch renderer React | Build/reproducibility | ES2020, lockfile đồng bộ, React 19/Fiber 9/Drei 10, bổ sung dependency thực sự được import |
| 3D Text phụ thuộc font mạng; scene/camera không phù hợp viewport hẹp | Schematic | CanvasTexture Unicode và camera/fog theo aspect ratio |
| MinIO healthcheck dùng /dev/tcp trong shell không hỗ trợ | Docker readiness | HTTP readiness với wget/curl; image local đã kiểm tra |

## B. Changes Implemented

Các thay đổi nằm trong working tree nhánh `fix/data-lake-full-stack-recovery`, HEAD `3e9cea3`. Chưa commit/merge/deploy.

- [i18n](../../apps/web/src/i18n): resource EN/VI, persistence và regression tests.
- [API client](../../apps/web/src/services/api/client.ts): phân biệt lỗi transport/timeout/HTTP/validation.
- [Các services/adapters](../../apps/web/src/services): decode wire contract trước khi đưa vào UI; giữ Kafka offset dạng string.
- [Các màn hình](../../apps/web/src/screens) và [components](../../apps/web/src/components): trạng thái có dữ liệu/rỗng/lỗi, query gating, form đúng payload, DQ error không lặp, SQL chỉ chạy sau submit.
- [Home query](../../apps/web/src/services/queries/home.queries.ts): tổng hợp nguồn thật và giữ null khi request thất bại; nhãn records là all time thay vì giả định 24h.
- [Health service](../../apps/api/src/modules/health/services/health.service.ts): named checks, timeout, không ngắt Mongo sau basic check; Airflow kiểm tra scheduler/metadatabase trong body.
- [Airflow repository](../../apps/api/src/modules/airflow/repositories/airflow.repository.ts): phân trang DAG, đếm run theo state bằng total_entries; bỏ catch trả số 0 khi upstream lỗi.
- [Bronze dispatcher](../../apps/api/src/modules/bronze/workers/bronze.worker.ts): route theo kind và ghi failed khi executor chưa triển khai.
- [Compose](../../docker-compose.yml), [broker console config](../../configs/redpanda-console.yaml), [dev scripts](../../scripts), [CI](../../.github/workflows/ci.yml), [lockfile](../../pnpm-lock.yaml): cấu hình chạy và cài đặt có thể lặp lại.
- [Browser suite](../../apps/web/e2e), [cấu hình Playwright](../../apps/web/playwright.config.ts), [API probe](../../scripts/verify-control-plane.mjs): bằng chứng có thể tạo lại.

Các thay đổi asset background/logo, cấu hình lint/Nx có sẵn và thay đổi environment template trước phiên được giữ nguyên. Credential local nằm trong environment ignored; không đưa vào báo cáo hay source. Đã thêm biến Fernet key local; phải giữ ổn định key khi có dữ liệu mã hóa.

## C. i18n Results

Cả 11 màn hình trong mục E được mở trực tiếp ở EN và VI. Test kiểm tra parity của resource, static t()/Trans keys, fallback, EN → VI → EN. Browser kiểm tra đổi ngôn ngữ, reload và navigation. Kiểm tra tự động raw keys không thay thế việc duyệt toàn bộ mọi chuỗi động hoặc mọi màn detail khi có dữ liệu thật.

## D. Backend Connection Results

Probe chạy chỉ đọc sau production build bằng `node scripts/verify-control-plane.mjs`; [JSON](../../test-results/api-results.json) ghi timestamp `2026-10-21T01:33:01.418Z` và response thật. Kết quả 23/23 HTTP 200. Basic/deep health HTTP 200 cần đọc body; HTTP 200 riêng không đủ chứng minh toàn nền tảng sẵn sàng.

| Endpoint | HTTP |
|---|---|
| GET /api/health | 200 |
| GET /api/health/deep | 200 |
| GET /api/catalog/databases | 200 |
| GET /api/catalog/tables | 200 |
| GET /api/bronze | 200 |
| GET /api/bronze/jobs | 200 |
| GET /api/bronze/jobs/stats | 200 |
| GET /api/silver | 200 |
| GET /api/silver/jobs | 200 |
| GET /api/silver/jobs/stats | 200 |
| GET /api/gold | 200 |
| GET /api/gold/jobs | 200 |
| GET /api/gold/jobs/stats | 200 |
| GET /api/crawler | 200 |
| GET /api/crawler/stats | 200 |
| GET /api/kafka/topics | 200 |
| GET /api/kafka/consumer-groups | 200 |
| GET /api/kafka/stats | 200 |
| GET /api/airflow/dags | 200 |
| GET /api/airflow/stats | 200 |
| GET /api/dq/rules | 200 |
| GET /api/dq/runs | 200 |
| GET /api/dq/summary | 200 |

Wire contract: data wrapper; catalog/layer list là array; job/DQ pages là total/items; Kafka list có topics/groups/count; Airflow có total/items và các stats camelCase. Frontend chuyển đổi tại adapter, không sửa response để che mapper lỗi.

Deep health tại lần probe: MongoDB, Redis, DuckDB, MinIO, Kafka, Airflow đều up. Đây là connectivity/readiness của dependency được kiểm tra, không chứng minh ingestion/ETL hoàn thành. Airflow có 3 DAG pause, 0 run; lỗi import crawler vẫn còn (mục I).

API và web chạy local, không gọi trực tiếp Kafka/Airflow từ trình duyệt. Vite proxy chuyển /api sang API. CORS có test origin được phép, bị từ chối và preflight. Không thêm auth mới hay vô hiệu hóa auth; lỗi upstream Airflow 401/403 được giữ riêng.

## E. Per-Screen Verification

| Màn hình | Route | Ngôn ngữ | Ảnh thực tế |
|---|---|---|---|
| Home | / | EN + VI | [EN](../../test-results/browser/screens-home-renders-en-against-the-live-API/home-en.png), [VI](../../test-results/browser/screens-home-renders-vi-against-the-live-API/home-vi.png) |
| Catalog | /catalog | EN + VI | [EN](../../test-results/browser/screens-catalog-renders-en-against-the-live-API/catalog-en.png), [VI](../../test-results/browser/screens-catalog-renders-vi-against-the-live-API/catalog-vi.png) |
| Bronze | /bronze | EN + VI | [EN](../../test-results/browser/screens-bronze-renders-en-against-the-live-API/bronze-en.png), [VI](../../test-results/browser/screens-bronze-renders-vi-against-the-live-API/bronze-vi.png) |
| Silver | /silver | EN + VI | [EN](../../test-results/browser/screens-silver-renders-en-against-the-live-API/silver-en.png), [VI](../../test-results/browser/screens-silver-renders-vi-against-the-live-API/silver-vi.png) |
| Gold | /gold | EN + VI | [EN](../../test-results/browser/screens-gold-renders-en-against-the-live-API/gold-en.png), [VI](../../test-results/browser/screens-gold-renders-vi-against-the-live-API/gold-vi.png) |
| Crawler | /crawler | EN + VI | [EN](../../test-results/browser/screens-crawler-renders-en-against-the-live-API/crawler-en.png), [VI](../../test-results/browser/screens-crawler-renders-vi-against-the-live-API/crawler-vi.png) |
| Kafka | /kafka | EN + VI | [EN](../../test-results/browser/screens-kafka-renders-en-against-the-live-API/kafka-en.png), [VI](../../test-results/browser/screens-kafka-renders-vi-against-the-live-API/kafka-vi.png) |
| Airflow | /airflow | EN + VI | [EN](../../test-results/browser/screens-airflow-renders-en-against-the-live-API/airflow-en.png), [VI](../../test-results/browser/screens-airflow-renders-vi-against-the-live-API/airflow-vi.png) |
| Dq | /dq | EN + VI | [EN](../../test-results/browser/screens-dq-renders-en-against-the-live-API/dq-en.png), [VI](../../test-results/browser/screens-dq-renders-vi-against-the-live-API/dq-vi.png) |
| Health | /health | EN + VI | [EN](../../test-results/browser/screens-health-renders-en-against-the-live-API/health-en.png), [VI](../../test-results/browser/screens-health-renders-vi-against-the-live-API/health-vi.png) |
| Schematic | /schematic | EN + VI | [EN](../../test-results/schematic-check/screens-schematic-renders-en-against-the-live-API/schematic-en.png), [VI](../../test-results/schematic-check/screens-schematic-renders-vi-against-the-live-API/schematic-vi.png) |

- Home: số 0 có nguồn thật, unknown là —, API status tách khỏi deep health, không trend/activity giả.
- Catalog: API local đang rỗng; fixture riêng xác minh chọn database rồi mới fetch tables đúng database.
- Bronze/Silver/Gold: list/jobs/stats rỗng thật; query read-only SELECT 1 đã chạy thật. Form/action có contract tests; không chứng minh executor ghi Delta thành công.
- Crawler: 5 metadata definitions thật từ registry; metadata không đồng nghĩa crawler execution chạy được. Preview chỉ gọi khi chọn tab, giới hạn số item.
- Kafka: broker/topic/group/stats thực; hiện không có topic. Offset lớn và message payload được kiểm tra bằng fixture.
- Airflow: 3 DAG thực đều pause; không trigger/unpause. Task/log/Gantt unit conversion được test bằng fixture.
- DQ: rules/runs rỗng; chưa chạy suite thì không gán 100%. Suite form gửi ruleIds đúng contract.
- Health: API availability, services và dependency checks tách rõ; Refresh có request thật.
- Schematic: giữ static nodes/relations, không gán online/metric giả; inspect và responsive không đổi dependency.

## F. Test Execution

Thực hiện bởi Codex trên máy local ngày 2026-10-21, mục đích phát hiện hồi quy sau các thay đổi nêu trên. Log dưới đây là bằng chứng từng nhóm, không đại diện cho production.

| Lệnh/nhóm | Kết quả | Bằng chứng |
|---|---|---|
| CI=true pnpm install --frozen-lockfile | PASS | [install](../../test-results/frozen-install.log) |
| pnpm --filter @lakehouse/web typecheck | PASS sau sửa cuối | [web typecheck](../../test-results/web-typecheck.log) |
| pnpm --filter lakehouse-api typecheck | PASS sau sửa cuối | [API typecheck](../../test-results/api-typecheck.log) |
| pnpm --filter @lakehouse/web test | 83 PASS | [web tests](../../test-results/web-tests-final.log) |
| pnpm --filter lakehouse-api test | 62 PASS | [API tests](../../test-results/api-tests-final.log) |
| pnpm --filter @lakehouse/web build | PASS | [web build](../../test-results/web-build.log) |
| pnpm --filter lakehouse-api build | PASS sau health fix | [API build](../../test-results/api-build.log) |
| pnpm --filter lakehouse-api lint | PASS, 7 warning console có sẵn | [API lint](../../test-results/api-lint.log) |
| pnpm --filter @lakehouse/web test:e2e | 31/31 PASS; thêm 3/3 ca Schematic sau sửa camera/fog | [browser log](../../test-results/browser-run.log), [JSON](../../test-results/browser-results.json) |
| node scripts/verify-control-plane.mjs | 23 endpoint HTTP 200 | [probe](../../test-results/api-probe.log) |
| docker compose config --quiet, bash -n dev/deploy scripts, git diff --check | PASS | kiểm tra trực tiếp local |
| venv/bin/python -m pytest tests/ -q | BLOCKED: thiếu pytest | [Python tests](../../test-results/python-tests.log) |
| venv/bin/python -m ruff check src tests | BLOCKED: thiếu ruff | [Python lint](../../test-results/python-lint.log) |
| venv/bin/python -m pip check | Không có broken requirement trong venv hiện tại; chưa đủ dependencies | [pip check](../../test-results/python-dependencies.log) |
| venv/bin/python -c 'import src' | PASS namespace import; không chứng minh Spark/pipeline | [import](../../test-results/python-import.log) |

Python install đã thử cả sandbox và cấp quyền mạng. Lần đầu lỗi DNS, lần có quyền mạng tải setuptools rồi timeout tại files.pythonhosted.org. Không sửa Python business logic trong đợt này; hồi quy Python chưa xác minh.

Warning còn lại: bundle web lớn, PostCSS from option, Node localStorage/Vite CJS deprecation trong môi trường local, transitive Swagger UI React peers; không được diễn giải thành kiểm tra production đã hoàn thành.

## G. Browser Evidence

Chrome thật, Playwright một worker, API local có MinIO/Mongo/Redis/Redpanda/Airflow. Web server kiểm thử riêng cổng 5174; API cổng 3001. Không lấy fixture test làm bằng chứng backend thật.

22 ca desktop EN/VI; 6 ca tương tác (language/reload/navigation, SELECT 1 submit, 503 rồi retry backend thật, 401, chọn database fixture, Health refresh + dark); 3 ca mobile Home/Catalog/Schematic. Lượt browser đầy đủ đạt 31/31. Sau khi xem ảnh phát hiện fog che scene mobile, đã sửa và chạy lại riêng 3/3 ca Schematic; [log retest](../../test-results/schematic-check.log) và ảnh Schematic ở bảng E là bằng chứng sau sửa cuối. Ảnh ở bảng E, [mobile schematic](../../test-results/schematic-check/screens-schematic-fits-a-mobile-viewport/schematic-mobile.png), [dark health](../../test-results/browser/interactions-Health-refres-f3c04-ain-and-dark-theme-persists/health-dark.png).

Fixtures chỉ tồn tại trong test. Màn data-empty được kiểm tra bằng backend thật; populated catalog, lỗi 401/503 và các detail contracts dùng fixture riêng. Không có seed vào Mongo/MinIO để làm màn hình trông đủ dữ liệu.

## H. Regression Results

Coverage tập trung shared i18n, transport/CORS, adapter, status/zero-vs-unknown, source identifiers, large Kafka offsets, Airflow count endpoint/readiness, queue routing và action payload. Schema test “integration” của API phần lớn là unit/schema tests; bằng chứng kết nối thật là probe/browser riêng.

Giữ quan hệ static trong schematic, API paths/business rules hiện có và dữ liệu người dùng. Không chạy vacuum/optimize/delete, produce/crawl, ingest/transform/aggregate, suite hoặc trigger DAG trên dữ liệu thực.

## I. Remaining Risks/Blockers

1. **Bronze executor chưa triển khai**: nay throw failed rõ thay vì completed zero. Chưa có entrypoint worker được xác minh. Silver/Gold ghi Delta chưa có end-to-end test thật; không tuyên bố pipeline chạy được.
2. **Storage contract lệch**: [Python LakePaths](../../src/lakehouse/core/paths.py) dùng bucket từng layer; API repositories đọc lakehouse/layer/database/table. Danh sách rỗng local không chứng minh đọc được dataset Python hiện hữu. Cần thống nhất storage contract và test dataset biệt lập trước migration.
3. **Airflow crawler import**: image stock thiếu module kafka, khiến crawler_dag không đăng ký. 3 DAG còn lại pause không đồng nghĩa Spark runtime/JAR/script paths đã hợp lệ. Cần image dependencies đầy đủ và test executor riêng.
4. **Python regression blocked**: môi trường chưa cài dependencies; network timeout. Không có kết quả pytest/ruff để gán PASS.
5. **Nonempty data và mutation execution**: chỉ được test contract/fixtures; chưa có bằng chứng ghi Delta/crawl/produce/suite thành công. Không dùng mock thay production.
6. **Production/cloud**: chưa triển khai public API, Cloudflare, auth deployment, TLS, bucket permissions hoặc Databricks integration. Credential được cung cấp không tự tạo integration. CI workflow đã cập nhật nhưng chưa chạy trên GitHub trong phiên này.
7. **Default MinIO image**: runtime đã kiểm tra bằng image local có wget; image tối giản khác phải có wget/curl hoặc cung cấp healthcheck tương ứng. Không tuyên bố mọi image tag hoạt động.
8. Browser responsive chỉ kiểm tra 3 màn mobile; không phải chứng nhận mọi kích thước/browser/interaction. Screenshot/log trong ignored test-results được giữ trên workspace, không tự có trong clone mới.

## J. Completion Status

**VERIFIED PASS**: các sửa i18n/shared transport/adapters được test; web/API build/typecheck trong môi trường local; 23 read endpoint; 31/31 browser test và 3/3 Schematic retest; ảnh Schematic cuối đã được xem trực tiếp.

**PARTIALLY VERIFIED**: toàn nền tảng và các action ingestion/transformation/aggregation/crawler/DQ; hợp đồng UI được sửa nhưng chưa có executor end-to-end an toàn để chứng minh toàn bộ chuỗi.

**BLOCKED**: Python regression và crawler DAG import do dependencies; production/cloud chưa có môi trường xác minh.

Không gán “100% fixed”. Điểm tiếp tục: tạo image Python/Airflow reproducible, thống nhất bucket/path contract bằng dataset test biệt lập, rồi kiểm tra executor/job lifecycle có kiểm soát. Các bước này cần được theo dõi thành phạm vi triển khai tiếp theo, không ẩn bằng trạng thái healthy của frontend.

## Databricks follow-up

The subsequent [Databricks integration report](DATABRICKS_INTEGRATION_RESULT.md) records the newly connected cloud read provider. Earlier local execution/storage limitations remain historical findings, not a claim that the current web lacks Databricks connectivity.
