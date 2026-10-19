# Tình trạng dự án và các việc còn lại

> **Cập nhật:** 2026-10-18
> **Mục đích:** Ghi lại phần đã làm, phần đã kiểm tra, các ý tưởng chưa hoàn tất và thứ tự nên tiếp tục.
> **Lưu ý bảo mật:** Không đọc hoặc lưu giá trị trong `.env`; không đưa credentials vào tài liệu hoặc chat.

## Kết luận ngắn

Project đã có pipeline lakehouse local, giao diện/API, các thí nghiệm và cấu hình để hỗ trợ S3-compatible storage. Demo console local đã chạy thành công theo kết quả người dùng gửi. Tuy vậy, hiện **chưa nghiệm thu end-to-end toàn hệ thống**, **chưa xác nhận Spark/Delta ghi đọc được R2**, và **chưa có backend/cloud deployment được kiểm chứng**.

Đây là project đang phát triển/demo, **không nên xem là production-ready**. Có nhiều thay đổi chưa commit trong working tree; cần giữ nguyên và không chạy lệnh reset/cleanup có thể xóa dữ liệu hoặc thay đổi của người dùng.

## Những phần đã có và bằng chứng hiện tại

| Phần | Trạng thái | Bằng chứng / giới hạn |
|---|---|---|
| Batch Bronze → Silver → Gold | Đã chạy demo local | Theo output `make demo` người dùng gửi ngày 2026-10-16: đọc 1.000 orders, ghi 1.000 Bronze và 1.000 Silver, tạo 340 dòng Gold; tổng revenue 1,510,199.14. Output demo ở `_experiments_workspace/demo/`, không phải R2. |
| Thí nghiệm lakehouse | Có scripts và CSV kết quả | `experiments/` và `results/` có các kết quả schema evolution/time travel, ETL vs ELT và benchmark. Các thí nghiệm này không thay thế xác nhận production hoặc workload cloud. |
| Python tests | **192 passed, 6 skipped** | Chạy trong lần rà soát này bằng `.venv/bin/python -m pytest --no-cov -q`. Sáu test pipeline được skip; đây không phải kiểm tra đầy đủ toàn bộ stack Docker. |
| API | Tests, typecheck và build chạy được | API Vitest: 44 tests passed; `pnpm --filter lakehouse-api typecheck` pass; build pass nhưng có cảnh báo dynamic dependency từ `swagger-jsdoc`. |
| Web UI | Build thành công; tests chưa chạy được | `pnpm --filter @lakehouse/web build` pass nhưng báo một số bundle lớn. Vitest không khởi động được do thiếu dependency `jsdom`. |
| R2/S3 compatibility | Có code và smoke-test | Có cấu hình S3A, adapter API và `make verify-r2`. Nhưng chưa có bằng chứng ghi/đọc Delta trên tài khoản R2 thật. |
| Local containers | Có Docker Compose | Lệnh kiểm tra cấu hình Compose core dừng vì `.env` thiếu giá trị `AIRFLOW_FERNET_KEY`. Không khởi động container trong lần rà soát này. |
| UI đã deploy | Người dùng đã báo đã deploy UI | Chưa có URL hoặc kết quả kiểm tra UI gọi đúng API trong repo/cuộc trò chuyện này. UI deploy riêng không chứng minh backend, R2 hay pipeline đã hoạt động. |

## Việc còn dang dở — ưu tiên thực hiện

### P0 — Mở khóa cấu hình local và xác nhận R2

- [ ] **Bổ sung `AIRFLOW_FERNET_KEY` vào `.env` nếu chạy Docker Compose.** Lệnh kiểm tra cấu hình Compose core hiện báo thiếu biến này nên không xác nhận được cấu hình. Tạo key mới cục bộ bằng `openssl rand -base64 32 | tr '+/' '-_'`, rồi điền vào `.env`; không gửi key qua chat.
- [ ] **Hoàn thành cấu hình Cloudflare R2 trong `.env` cục bộ.** Cần endpoint theo account và R2 Access Key/Secret Key có quyền tối thiểu trên các bucket cần dùng. Trong lần kiểm tra hiện tại, các biến `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` không được phát hiện trong `.env`; giá trị bí mật không được đọc hoặc ghi lại.
- [ ] **Chạy `make verify-r2` sau khi tự cấu hình credentials.** Lần chạy trước dừng ngay vì không có `S3_ENDPOINT`, nên chưa thực hiện kết nối mạng. Smoke test này mới xác nhận bước S3A + Delta ghi/đọc; không thay thế việc kiểm tra pipeline đầy đủ.
- [ ] **Chỉ sau khi smoke test pass, chạy batch pipeline theo quy trình R2** bằng `.venv/bin/python -m lakehouse.pipelines.batch_retail`, sau đó xác nhận Bronze/Silver/Gold đọc lại được từ R2 và số dòng khớp. `make demo` ghi local; `make pipeline-batch` submit job tới Spark trong Docker, chưa được kiểm chứng với R2 trong lần rà soát này.
- [ ] **Kiểm tra lại chi phí và lifecycle trước khi áp dụng.** Các policy trong `infra/r2/` hiện là file cấu hình; repo không chứng minh chúng đã được áp dụng lên bucket thật.

Hướng dẫn cấu hình hiện có: [R2 setup](./operations/R2_SETUP.md). Các hướng dẫn trong file này là thao tác cần làm, không phải bằng chứng rằng tài khoản/bucket đã được cấu hình.

### P0 — Chạy toàn bộ tool bằng container local

- [ ] **Dùng Docker Compose local làm runtime chính.** Không triển khai Northflank/Render; các tool chạy trên máy này qua `docker-compose.yml`, `docker-compose-kafka.yml` và tùy chọn `docker-compose.dev-api.yml`.
- [ ] **Chạy lại Compose sau khi thêm Fernet key.** Sau đó kiểm tra health của core stack và API/Web local.
- [ ] **Chỉ dùng R2 như storage tùy chọn.** Nếu bật R2, credentials chỉ để trong `.env`; compute và orchestration vẫn chạy trong các container local.

### P1 — Nghiệm thu local end-to-end và sửa quality gates

- [ ] Sửa lint hiện tại: Ruff báo 1 lỗi `F401` trong `src/lakehouse/core/paths.py`.
- [ ] Đồng bộ format: Black hiện báo 11 file cần format lại. Chạy formatter có review diff, không dùng auto-fix mù trên working tree đang có thay đổi.
- [ ] Xử lý 19 lỗi mypy hiện tại trên 6 file Python; đặt rõ Python runtime được hỗ trợ/kiểm thử thay vì chỉ dựa vào `requires-python >=3.10`.
- [ ] Cài/khôi phục dependency `jsdom` trong workspace theo lockfile rồi chạy lại Web tests. Không thay lockfile hoặc cài package ngoài ý muốn trong lúc có thay đổi chưa commit.
- [ ] Chạy lại Compose validation sau khi cấu hình `AIRFLOW_FERNET_KEY`; nếu pass, mới thử bring-up và health checks, rồi batch/streaming/Airflow/API theo runbook đã được cập nhật.
- [ ] Kiểm tra lại CI: workflow đang trỏ tới `apps/web/pnpm-lock.yaml` (file không tồn tại; lockfile ở root) và `docker-compose.api.yml` (file không tồn tại; hiện có `docker-compose.dev-api.yml`). Workflow hiện chưa có job riêng chạy API tests/typecheck/build.
- [ ] Chạy nghiệm thu streaming thật: tạo event, xác nhận Kafka topic, Delta output/checkpoint và recovery sau restart. Unit tests không chứng minh cluster streaming chạy end-to-end.

### P1 — Đồng bộ tài liệu với code và quyết định triển khai

- [ ] Sửa README claims đang lệch hiện trạng: ghi Terraform hỗ trợ GCP/AWS/Azure trong khi repo chỉ có `terraform/gcp/main.tf`; số API routes/cấu trúc thư mục và danh sách crawler/DAG cũng cần đo lại trước khi công bố.
- [ ] Cập nhật [E2E_RUNBOOK.md](./operations/E2E_RUNBOOK.md): còn tham chiếu `docker-compose.spark.yml` không tồn tại và tên service Redpanda cũ.
- [ ] Cập nhật [quickstart.md](./operations/quickstart.md): còn dùng service names và lệnh seed không khớp cấu hình/package hiện tại.
- [ ] Rà soát nội dung cloud: [R2_SETUP.md](./operations/R2_SETUP.md) mô tả các thao tác như thể setup đã hoàn thành, trong khi kết nối chưa được xác minh; [terraform/README.md](../terraform/README.md) còn mô tả `terraform/oracle/` không tồn tại.
- [ ] Đánh dấu rõ tài liệu audit cũ theo ngày/điều kiện. Không dùng kết quả Phase 11 ngày 2026-10-16 như trạng thái hiện tại nếu chưa chạy lại; ví dụ lockfile đã có importers `apps/api` và `apps/web` trong snapshot hiện tại.

### P2 — Hoàn thiện yêu cầu đồ án và chuẩn bị dùng thật

- [ ] Nếu rubric yêu cầu so sánh Data Lake file thường với Lakehouse, bổ sung benchmark đối chứng Parquet-vs-Delta trên cùng workload; audit Phase 13 ghi hạng mục này còn thiếu.
- [ ] Tạo biểu đồ từ CSV benchmark và hoàn thiện báo cáo kỹ thuật/video demo nếu đây là deliverables của đồ án. Đây là phần nội dung trình bày, không tự hoàn thành chỉ bằng code trong repo.
- [ ] Trước khi mở API ra Internet, rà soát lại xác thực/phân quyền cho các thao tác quản trị và SQL nguy hiểm; audit API cũ đã ghi nhận một số route nhạy cảm chưa có auth tại thời điểm audit. Không coi cấu hình CORS hoặc URL khó đoán là thay thế authentication.
- [ ] Thay các mật khẩu mặc định dành cho local demo, bật log redaction phù hợp và xác nhận không ghi credentials vào log.

## Những việc chưa được thực hiện

- Chưa ghi hoặc đọc Delta table trên Cloudflare R2 thật; chưa chạy pipeline batch thật tới R2.
- Không triển khai API/backend lên Northflank hoặc Render; phạm vi hiện tại là chạy local bằng Docker Compose.
- Chưa xác nhận toàn bộ API/Web local chạy end-to-end cùng các dependency.
- Chưa chạy toàn bộ Docker Compose, Airflow DAG, Kafka streaming và API/Web cùng nhau từ đầu đến cuối trong lần rà soát này.
- Chưa xác nhận chi phí thực tế hoặc điều kiện free tier của tài khoản cloud.
- Chưa gọi project là production-ready.

## Cập nhật 2026-10-19 — lỗi còn đang mắc phải

Các lệnh kiểm tra ETL/ELT gần nhất đã chạy xong không báo lỗi trong task shell. Tuy nhiên, kết quả đó chỉ xác nhận các script thử nghiệm/pipeline tương ứng; chưa đủ để kết luận toàn bộ stack đã nghiệm thu. Những lỗi và điểm chưa xác nhận cần tiếp tục ghi lại như sau:

| Mức độ | Lỗi / vấn đề | Trạng thái và cách xử lý tiếp |
|---|---|---|
| P0 | Compose validation dừng vì thiếu `AIRFLOW_FERNET_KEY` trong `.env` | Tạo key cục bộ bằng `openssl rand -base64 32 | tr '+/' '-_'`, điền trực tiếp vào `.env`, sau đó chạy lại lệnh kiểm tra Compose. Không ghi key vào repo hoặc chat. |
| P0 | Chưa xác nhận Spark/Delta ghi và đọc được Cloudflare R2 thật | Chưa có `S3_ENDPOINT`/credentials hợp lệ trong môi trường kiểm tra. Sau khi tự cấu hình `.env`, chạy `make verify-r2`; nếu pass mới chạy batch và đối chiếu số dòng Bronze/Silver/Gold. |
| P0 | Chưa nghiệm thu full Docker stack | Chưa chứng minh được Kafka, Spark, Airflow, API và UI chạy cùng nhau từ đầu đến cuối. Cần kiểm tra health trước, rồi mới chạy batch/streaming theo runbook. |
| P1 | Quality gate còn lỗi | Ruff còn `F401` tại `src/lakehouse/core/paths.py`; Black còn các file lệch format; mypy còn 19 lỗi trên 6 file. Sửa từng nhóm và review diff vì working tree đang có nhiều thay đổi chưa commit. |
| P1 | Web tests chưa chạy | Vitest không khởi động vì thiếu `jsdom`. Cần khôi phục dependency theo workspace/lockfile rồi chạy lại test, không cài tùy tiện làm thay đổi lockfile ngoài ý muốn. |
| P1 | CI đang tham chiếu đường dẫn không tồn tại | Workflow còn trỏ tới `apps/web/pnpm-lock.yaml` và `docker-compose.api.yml`, trong khi lockfile nằm ở root và compose hiện có `docker-compose.dev-api.yml`. Cần sửa workflow rồi chạy lại CI. |
| P1 | Streaming chưa có bằng chứng chạy thật | Unit tests đã có, nhưng chưa xác nhận event đi qua Kafka, tạo Delta output/checkpoint và resume sau restart trên cluster đang chạy. |
| P1 | Local Compose chưa được nghiệm thu đầy đủ | Cần bổ sung `AIRFLOW_FERNET_KEY`, chạy `make up` rồi `make up-api`, kiểm tra health và luồng batch/streaming/API trên cùng Docker network. |
| P2 | Rubric còn thiếu benchmark file lake vs lakehouse | Đã có ETL-vs-ELT và performance experiments, nhưng chưa có benchmark Parquet thường đối chứng Delta trên cùng workload. |
| P2 | Chưa có biểu đồ từ CSV benchmark | CSV kết quả đã có; phần tạo chart và đưa vào báo cáo/video vẫn chưa làm. |

### Kết quả mới nhất cần ghi nhận

- ETL/ELT verification: task shell đã hoàn tất với trạng thái success.
- Không có bằng chứng mới cho việc R2, Docker Compose full stack, Airflow hoặc streaming end-to-end đã pass.
- Các thay đổi trong working tree vẫn phải được giữ nguyên; không chạy `git reset`, `git clean` hoặc script reset/xóa dữ liệu khi chưa sao lưu và phân loại.

## Thứ tự tiếp tục khuyến nghị

1. Bổ sung Fernet key cho local Compose nếu cần chạy stack; giữ bí mật trong `.env`.
2. Cấu hình R2 credentials trực tiếp trên máy, chạy `make verify-r2`, xử lý lỗi cho tới khi pass.
3. Chạy pipeline retail trên host Mac và xác nhận đọc lại dữ liệu Gold từ R2.
4. Chạy `make up`, kiểm tra core containers, rồi chạy `make up-api` để bật API/Web local.
5. Chạy batch, Kafka streaming và Airflow trên cùng stack local; ghi lại lỗi thực tế nếu còn.
6. Sửa quality gates/CI và cập nhật runbook trước khi xem là nghiệm thu local.

**An toàn working tree:** tại thời điểm rà soát có nhiều file modified, deleted và untracked. Không chạy `git reset`, `git clean`, `make reset` hoặc thao tác xóa dữ liệu nếu chưa phân loại và sao lưu các thay đổi cần giữ.
