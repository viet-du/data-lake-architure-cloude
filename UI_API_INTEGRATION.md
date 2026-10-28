# Đặc tả API cho các tool trên UI

Tài liệu đối chiếu UI React Query/services với route handlers và Zod schemas trong `apps/api/src`. Base path là `/api`. Các API được gọi qua cùng origin trừ khi cấu hình API base URL khác. JSON response thành công thường được bọc trong `{ "data": ... }`; lỗi được chuẩn hóa bởi middleware `withErrorHandler` (xem response thực tế của từng handler). Các ví dụ dưới đây là payload mẫu theo schema; không thay thế OpenAPI runtime.

**Trạng thái:** `Đang dùng` nghĩa UI có query/mutation; `Có thể bổ sung` nghĩa route backend tồn tại nhưng chưa thấy tool UI tương ứng; `Đề xuất` nghĩa route chưa tồn tại.

## Home `/`

Home tổng hợp dữ liệu ở frontend, refresh mỗi 30 giây:

- `GET /api/catalog/databases` - database và số bảng.
- `GET /api/bronze/jobs/stats`, `GET /api/silver/jobs/stats`, `GET /api/gold/jobs/stats` - job/record stats từng layer.
- `GET /api/kafka/stats` - topic/lag stats.
- `GET /api/airflow/stats` - DAG stats.
- `GET /api/dq/summary` - DQ pass rate.
- `GET /api/health` - health status/uptime.

Activity feed chưa có API và hiện rỗng. Đề xuất `GET /api/dashboard/activity`. API tổng hợp để thay 8 request trên: đề xuất `GET /api/dashboard/summary`. Cả hai route đề xuất chưa được implement.

## Catalog `/catalog`

### Đang dùng

- `GET /api/catalog/databases` - liệt kê database. Response: `{ data: Database[] }`.
- `GET /api/catalog/databases/{db}/tables` - liệt kê bảng trong database.
- `GET /api/catalog/tables/{tableId}` - metadata bảng.
- `GET /api/catalog/tables/{tableId}/schema` - schema cột.
- `GET /api/catalog/tables/{tableId}/sample` - sample rows; hỗ trợ `?limit={1..1000}`.

### Có thể bổ sung

- `GET /api/catalog/search?q={keyword}&layer={bronze|silver|gold}&database={db}&tag={tag}&limit={limit}` - tìm kiếm. `q` là nội dung tìm; query schema cũng hỗ trợ `limit`.
- `POST /api/catalog/tables/{tableId}/sync` - đồng bộ metadata Delta vào Mongo catalog và tự suy luận lineage. Không cần body. Response `200`, `{ data: ... }`.
- `GET /api/catalog/tables/{tableId}/lineage` và `GET /api/catalog/tables/{tableId}/stats` - lineage và số liệu bảng.
- `POST /api/catalog/databases` - tạo database. Body:

```json
{
  "database": "analytics",
  "description": "Optional description",
  "layers": ["bronze", "silver", "gold"]
}
```

`database` bắt buộc, 1-64 ký tự, lowercase alphanumeric/underscore; `description` tối đa 500 ký tự; `layers` tối thiểu 1 phần tử, mặc định cả ba layer. Thành công `201`; database trùng trả `409`.
- `DELETE /api/catalog/databases/{db}` - xóa database. Không có body.
- `PUT /api/catalog/tables/{tableId}` - cập nhật metadata bảng; `DELETE /api/catalog/tables/{tableId}` - xóa bảng. Xem schemas ở route/module tương ứng trước khi dựng form.

## Bronze `/bronze`

### Đang dùng

- `GET /api/bronze?database={db}&search={text}&limit={n}&offset={n}` - list/search bảng. `limit` mặc định 100, miền 1-1000; `offset` mặc định 0.
- `GET /api/bronze/{table}` - metadata; `GET /api/bronze/{table}/sample?limit={n}` - sample.
- `GET /api/bronze/{table}/stats`, `/history`, `/partitions` - stats, lịch sử, partitions.
- `GET /api/bronze/jobs?status={status}&kind={kind}&database={db}&table={table}&limit={n}&offset={n}` - danh sách job.
- `GET /api/bronze/jobs/stats` - tổng hợp job.
- `POST /api/bronze/ingest/json` - ingest JSON/JSONL. Body mẫu:

```json
{
  "database": "raw",
  "table": "events",
  "source": "s3://bucket/events.jsonl",
  "partition": "2026-10-24",
  "options": { "format": "jsonl", "compression": "none" }
}
```

`database`, `table`, `source` bắt buộc; table lowercase alphanumeric/underscore; partition tùy chọn `YYYY-MM-DD`; format `json|jsonl|ndjson`; compression `none|gzip|zstd`. Trả `201` khi tạo job.
- `POST /api/bronze/ingest/csv` - body có `database`, `table`, `source`; `partition` tùy chọn; `options`: `header` boolean (mặc định true), `delimiter` (mặc định `,`, tối đa 4 ký tự), `encoding` (mặc định `utf-8`). Trả `201`.
- `POST /api/bronze/ingest/stream/{topic}` - body `database`, `table`; `consumerGroup` mặc định `bronze-ingestor`, `maxMessages` mặc định 10000 (1-1,000,000), `timeoutMs` mặc định 60000 (1000-600000). Trả `201`.

### Có thể bổ sung

- `GET /api/bronze/jobs/{jobId}` - chi tiết job.
- `POST /api/bronze/{table}/vacuum` - body `{ "retentionDays": 7, "dryRun": false }`; retention 0-365 ngày.
- `DELETE /api/bronze/{table}/partitions/{date}` - xóa partition, `date` định dạng `YYYY-MM-DD`.

UI gọi `DELETE /api/bronze/jobs/{jobId}` dưới tên cancel. Backend route xử lý delete job; cần xác nhận có dừng worker hay không. Nếu chỉ xóa record, đề xuất tạo `POST /api/bronze/jobs/{jobId}/cancel`.

## Silver `/silver`

### Đang dùng

- `GET /api/silver?database={db}&search={text}&limit={n}&offset={n}` - list/search; `GET /api/silver/{table}` - metadata.
- `GET /api/silver/{table}/sample?limit={n}`, `/stats`, `/history` - sample/stats/history.
- `GET /api/silver/{table}/time-travel/{version}?limit={n}` - đọc version; `GET /api/silver/{table}/diff/{v1}/{v2}` - so sánh version.
- `GET /api/silver/jobs?status={status}&kind={kind}&database={db}&table={table}&limit={n}&offset={n}`; `GET /api/silver/jobs/stats`.
- `POST /api/silver/{table}/refresh` - body tùy chọn `{ "partition": "YYYY-MM-DD", "preserveHistory": false }`.
- `POST /api/silver/{table}/transform` - body `{ "kind": "full", "sourceTable": "events", "partition": "YYYY-MM-DD", "qualityChecks": true }`. `kind` theo `SILVER_TRANSFORM_KINDS`, mặc định `full`; các trường trừ kind đều tùy chọn.

### Có thể bổ sung

- `POST /api/silver/transform/all` - body `{ "kind": "full", "parallel": 4, "qualityChecks": true }`; `parallel` từ 1-16.
- `GET /api/silver/jobs/{jobId}` - chi tiết job.

UI gọi `DELETE /api/silver/jobs/{jobId}` dưới tên cancel. Xác nhận backend có dừng worker hay chỉ xóa job record.

## Gold `/gold`

### Đang dùng

- `GET /api/gold?database={db}&search={text}&kind={kind}&limit={n}&offset={n}`; `GET /api/gold/{table}` - list/detail.
- `GET /api/gold/{table}/sample?limit={n}`, `/stats`, `/history`, `/lineage` - detail.
- `POST /api/gold/{table}/refresh` - body tùy chọn `{ "partition": "YYYY-MM-DD", "preserveHistory": false }`.
- `POST /api/gold/{table}/aggregate` - body `{ "kind": "full", "sourceTables": ["orders"], "partition": "YYYY-MM-DD", "qualityChecks": true }`. `kind` mặc định `full`; `sourceTables` tùy chọn, tối đa 20; partition tùy chọn; quality checks mặc định bật.
- `GET /api/gold/queries/category-revenue?parent_category={value}&limit={n}`.
- `GET /api/gold/queries/business-metrics?days={n}&limit={n}`.
- `GET /api/gold/queries/customer-analytics?segment={value}&limit={n}`.
- `GET /api/gold/queries/product-performance?category={value}&days={n}&limit={n}`.
- `GET /api/gold/queries/ad-hoc?sql={urlEncodedSelect}&limit={n}`. Chỉ SELECT, một statement, tối đa 10,000 hàng; mặc định 1,000. Không gửi SQL qua POST.
- `GET /api/gold/jobs?status={status}&kind={kind}&database={db}&table={table}&limit={n}&offset={n}`; `GET /api/gold/jobs/stats`.

### Có thể bổ sung

- `POST /api/gold/aggregate/all` - body `{ "kind": "full", "parallel": 4, "qualityChecks": true }`; `parallel` từ 1-16.
- `GET /api/gold/jobs/{jobId}` - chi tiết; `DELETE /api/gold/jobs/{jobId}` - xóa job record.

## Crawler `/crawler`

### Đang dùng

- `GET /api/crawler` - list jobs; `GET /api/crawler/stats` - thống kê.
- `GET /api/crawler/{name}` - job; `GET /api/crawler/{name}/config` - config; `GET /api/crawler/{name}/kafka-topic` - topic liên quan.
- `GET /api/crawler/{name}/preview?category={value}&language={value}&maxItems={n}` - preview.
- `GET /api/crawler/{name}/runs?status={status}&limit={n}&offset={n}` - runs.
- `GET /api/crawler/{name}/runs/{runId}/items?status={status}&limit={n}&offset={n}` - items.
- `POST /api/crawler/{name}/run` - chạy đồng bộ; `POST /api/crawler/{name}/run-async` - chạy async; `POST /api/crawler/{name}/stop` - dừng.

### Có thể bổ sung

- `GET /api/crawler/{name}/runs/{runId}` - chi tiết run.
- `PUT /api/crawler/{name}/config` - lưu config; payload phải tuân theo crawler config schema hiện hành.

## Kafka `/kafka`

### Đang dùng

- `GET /api/kafka/stats`, `GET /api/kafka/cluster` - stats và cluster.
- `GET /api/kafka/topics?internal={boolean}&pattern={regex}` - topics; `GET /api/kafka/topics/{topic}` - chi tiết.
- `GET /api/kafka/topics/{topic}/messages?partition={n}&fromOffset={n}&limit={n}&timeoutMs={n}` - đọc message. Mặc định offset 0, limit 10 (1-100), timeout 5000 ms (100-60000).
- `POST /api/kafka/topics/{topic}/produce` - body `{ "key": "optional", "value": "required", "headers": { "source": "ui" }, "partition": 0 }`. `value` bắt buộc; key/headers/partition tùy chọn. Trả `201`.
- `GET /api/kafka/consumer-groups?state={state}&pattern={regex}` và `GET /api/kafka/consumer-groups/{groupId}/lag?topic={topic}` - groups/lag.

### Có thể bổ sung

- `POST /api/kafka/topics/{topic}/produce-batch` - body `{ "messages": [{ "key": "optional", "value": "required", "headers": {}, "partition": 0 }] }`; 1-1000 message.
- `GET /api/kafka/consumer-groups/{groupId}` - group detail.
- `POST /api/kafka/consumer-groups/{groupId}/reset-offset` - body `{ "reset": "earliest", "topic": "events", "offset": 0, "partitions": [0] }`. `reset` theo `KAFKA_OFFSET_RESET`, mặc định `earliest`; topic bắt buộc; offset/partitions tùy chọn.
- `DELETE /api/kafka/topics/{topic}`, `DELETE /api/kafka/consumer-groups/{groupId}` - xóa tài nguyên; cần confirmation trong UI.

## Airflow `/airflow`

### Đang dùng

- `GET /api/airflow/dags?limit={n}&offset={n}&onlyActive={bool}&paused={bool}&tags={tags}&pattern={text}` - DAG list.
- `GET /api/airflow/stats`, `GET /api/airflow/dags/{dagId}` - stats/detail.
- `GET /api/airflow/dags/{dagId}/runs?state={state}&limit={n}&offset={n}&startDateGte={date}&startDateLte={date}&orderBy={field}` - runs.
- `GET /api/airflow/dags/{dagId}/runs/{runId}`, `/tasks`, `/gantt` - run, task list, gantt.
- `POST /api/airflow/dags/{dagId}/trigger` - trigger; `POST .../{dagId}/pause` - pause; `POST .../{dagId}/unpause` - resume. Body contract xem schema của Airflow trigger route; body rỗng nếu trigger không cần config.

### Có thể bổ sung

- Task logs có query/service trong frontend nhưng route cần xác minh trong backend. Path kỳ vọng từ endpoint registry: `GET /api/airflow/dags/{dagId}/runs/{runId}/tasks/{taskId}/logs?tryNumber={n}`. Kiểm tra route tồn tại trước khi nối.
- `DELETE /api/airflow/dags/{dagId}/runs/{runId}` - xóa run.
- `GET /api/airflow/health` - health Airflow.

## Data Quality `/dq`

### Đang dùng

- `GET /api/dq/summary` - summary.
- `GET /api/dq/rules?layer={layer}&type={type}&enabled={bool}&severity={severity}&table={table}&tag={tag}&limit={n}&offset={n}` - list rules. `limit` mặc định 100 (1-500), offset mặc định 0.
- `GET /api/dq/rules/{ruleId}` - detail.
- `POST /api/dq/rules/{ruleId}/run` - chạy rule; body tùy chọn `{ "partition": "date", "runId": "id", "limit": 1000, "sampleSize": 10 }`.
- `POST /api/dq/run-suite` - body `{ "name": "ad-hoc-suite", "ruleIds": ["rule-id"], "partition": "date", "limit": 1000, "sampleSize": 10 }`; `ruleIds` bắt buộc 1-200 phần tử.
- `GET /api/dq/runs?ruleId={id}&layer={layer}&status={pass|fail|error}&trigger={manual|suite|scheduled}&suiteRunId={id}&limit={n}&offset={n}`.

### Có thể bổ sung

- `GET /api/dq/presets` - rule presets.
- `POST /api/dq/rules` - tạo rule. Body:

```json
{
  "name": "email_not_null",
  "description": "Optional",
  "type": "null_check",
  "layer": "bronze",
  "table": "customers",
  "column": "email",
  "params": {},
  "severity": "medium",
  "enabled": true,
  "tags": []
}
```

`name`, `type`, `layer`, `table` bắt buộc. `type` một trong `null_check|range_check|in_set|unique|regex|custom_sql`; layer `bronze|silver|gold`; severity mặc định `medium`; enabled mặc định true.
- `PUT /api/dq/rules/{ruleId}` - cập nhật một phần các trường rule; body không nhận field ngoài schema.
- `DELETE /api/dq/rules/{ruleId}` - xóa rule.
- `GET /api/dq/runs/{runId}` - chi tiết run.

## Health `/health`

- `GET /api/health` - health cơ bản; đang dùng cho banner.
- `GET /api/health/deep` - dependency/services, latency, uptime/version; đang dùng trên màn Health.
- `GET /api/info` - thông tin build/runtime nếu cần hiển thị riêng.

## Schematic `/schematic`

Schematic hiện dựng sơ đồ từ frontend, chưa gọi API lấy topology. Có thể lấy lineage và stats từ:

- `GET /api/catalog/tables/{tableId}/lineage`.
- `GET /api/gold/{table}/lineage`.
- `GET /api/bronze/{table}/stats`, `GET /api/silver/{table}/stats`, `GET /api/gold/{table}/stats`.
- `GET /api/airflow/dags`, `GET /api/airflow/stats`.

API graph gộp cho UI: đề xuất `GET /api/lineage/graph` trả `{ nodes, edges, layerStatus }`; route chưa tồn tại.

## Settings

Route `/settings` chưa có screen được render trong navigation. Theme/language đang lưu phía client, chưa có API backend.

## Quy ước tích hợp

Dùng service và React Query hooks hiện có trong `apps/web/src/services/` và `apps/web/src/services/queries/`; không gọi `fetch` trực tiếp trong component. Tạo type từ contract/schema, xử lý loading/error/empty states, invalidate query liên quan sau mutation. Dữ liệu body và giới hạn được validate tại backend bằng Zod; request không hợp lệ trả lỗi validation qua middleware. Các endpoint đề xuất hoặc contract chưa xác minh được ghi rõ ở trên, không xem là API đã sẵn sàng.
