# BÁO CÁO CUỐI KỲ — NOTE ĐIỀN DẦN

> **Mục đích:** File này là "đề cương sống" để 3 thành viên điền nội dung vào khi project chạy.
> Sau khi project hoàn tất, copy các mục đã điền sang báo cáo Word/PDF chính thức.
>
> **Quy tắc:** Mọi con số / diagram phải kèm **bằng chứng** (file path, command, screenshot, log). Không viết suy đoán.

---

## 0. Thông tin nhóm (điền đầu tiên)

| Vai trò | Họ tên | Phụ trách mảng chính | Hiểu toàn bộ (Y/N) |
|---|---|---|---|
| Thành viên 1 | | | |
| Thành viên 2 | | | |
| Thành viên 3 | | | |

**Gợi ý phân công mảng (chọn 1):**
- **A.** Spark + Delta + Medallion (Bronze/Silver/Gold)
- **B.** Streaming (Kafka + Spark Structured Streaming + checkpoint)
- **C.** Airflow + API/UI + CI/CD

Mỗi người phụ trách 1 mảng nhưng **đọc hết repo + chạy demo** của 2 mảng còn lại.

---

## 0.5 Quyết định kiến trúc: Local Tools + Cloud Storage

**Quyết định (ghi lại để báo cáo):**

| Thành phần | Chạy ở đâu | Lý do |
|---|---|---|
| Spark, Airflow, Kafka, API, UI | **Local Mac** (Docker Compose) | RAM/Mac còn đủ, dễ debug, không tốn phí |
| Data (Bronze/Silver/Gold, checkpoint) | **Databricks Community Edition** (primary) | Native Delta Lake, notebook UI đẹp cho demo, $0 với 15GB free tier |
| Backup data | **Cloudflare R2** (optional) | $0 egress, persistent khi tắt máy, share link được |
| Streaming Kafka | Local (chỉ chạy khi demo) | Không cần trên cloud cho portfolio |

**Bằng chứng setup:**
- Databricks: [`docs/operations/DATABRICKS_SETUP.md`](../operations/DATABRICKS_SETUP.md)
- R2 (backup): [`docs/operations/R2_SETUP.md`](../operations/R2_SETUP.md)
- Data layout: [`docs/operations/DATA_LAYOUT.md`](../operations/DATA_LAYOUT.md) (mục "Storage backend")

**Switch MinIO ↔ R2:** chỉ sửa `.env`, không cần đổi code. Test: `./scripts/test_r2_connection.sh`

---

## 1. Thời gian thực tế (6–7 tuần)

| Tuần | Công việc dự kiến | Thực tế làm | Bằng chứng (commit/PR) |
|---|---|---|---|
| 1 | Audit repo, chốt scope | | |
| 2 | Local stack + Docker Compose chuẩn | | |
| 3 | Batch Bronze→Silver→Gold retail | | |
| 4 | Streaming + checkpoint + recovery | | |
| 5 | Airflow + API/UI + CI | | |
| 6 | Data quality + Catalog + observability | | |
| 7 | Cloud plan (chỉ lập kế hoạch) + viết báo cáo | | |

**Ngân sách & cảnh báo chi phí (điền bảng này):**

| Tài nguyên có phí | Ngân sách tối đa | Cảnh báo tại mức | Còn free đến |
|---|---|---|---|
| Render Web Service | $0 | — | sleep sau 15' idle |
| Render Cron Job | $0 | — | OK |
| Render Postgres | $0 → $7 sau 90 ngày | $0.01 (1 ngày) | 90 ngày |
| Cloudflare R2 | $0 (10GB, 10M req/tháng) | 80% quota | vĩnh viễn free tier |
| Metabase (nếu dùng) | $0 (nếu tắt) | RAM Mac > 4GB | — |

**Tổng chi phí dự kiến: $0** (nếu tắt Metabase + chỉ dùng free tier 90 ngày của Postgres).

---

## 2. Dữ liệu dùng trong project

**Loại dữ liệu (đánh dấu):**

- [ ] Dữ liệu công khai (nguồn: ____________)
- [ ] Dữ liệu tổng hợp (mô tả: ____________)
- [ ] Dữ liệu mock tự sinh (file: `src/lakehouse/sources/mock/retail_generator.py`)

**Cam kết KHÔNG commit vào repo:**

- [ ] Mật khẩu / API key / token thật → kiểm tra bằng `git log -p | grep -iE 'password|api_key|secret'` (chạy lệnh này trước khi nộp)
- [ ] Dữ liệu cá nhân → chỉ dùng mock ẩn danh
- [ ] Thông tin nội bộ công ty
- [ ] File `.env` thật → chỉ commit `.env.example`

---

## 3. Kho sản phẩm — checklist từng mục yêu cầu

| Yêu cầu | File / vị trí | Đã có (Y/N) | Ghi chú |
|---|---|---|---|
| README | `README.md` | | |
| Sơ đồ kiến trúc | `docs/architecture/ARCHITECTURE.md` | | |
| Mã nguồn | `src/lakehouse/`, `apps/api/src/`, `apps/web/src/` | | |
| IaC | `terraform/`, `render.yaml`, `docker-compose*.yml` | | |
| Kịch bản kiểm thử | `tests/`, `.github/workflows/ci.yml` | | |
| Dữ liệu đo thô | `experiments/` (output JSON/CSV) | | |
| Hướng dẫn tái lập | `docs/operations/E2E_RUNBOOK.md` | | |
| Danh sách phiên bản | `pyproject.toml`, `package.json` | | |

---

## 4. Báo cáo — cấu trúc theo rubric

### 4.1 Giả thuyết (Hypothesis)

> Mỗi thí nghiệm / quyết định kỹ thuật phải có giả thuyết rõ ràng.

**Ví dụ:**
- **H1:** Bronze layer ghi dạng append-only với schema enforcement sẽ cho phép replay lại từ Bronze khi Silver bị lỗi, mà không mất dữ liệu gốc.
- **H2:** Streaming với checkpoint trên MinIO sẽ resume chính xác sau khi restart container, vì Delta log là nguồn sự thật duy nhất.
- **H3:** Airflow chạy trong Docker với healthcheck phù hợp sẽ không bị race condition khi gọi Spark qua `docker exec`.

*Điền giả thuyết thật của nhóm vào đây:*

| # | Giả thuyết | Thí nghiệm kiểm chứng | Kết quả |
|---|---|---|---|
| H1 | | | |
| H2 | | | |
| H3 | | | |

### 4.2 Thiết kế thí nghiệm (Experimental Design)

> Mô tả: input, môi trường, cách đo, baseline, số lần lặp.

**Template cho mỗi thí nghiệm:**

```markdown
### Thí nghiệm [ID]: [Tên]

- **Mục tiêu:** (đo cái gì?)
- **Input:** (dữ liệu gì, bao nhiêu dòng?)
- **Môi trường:** (Mac M1 / 16GB RAM / Docker version)
- **Baseline:** (chạy ở điều kiện nào để so sánh?)
- **Biến độc lập:** (cái gì thay đổi giữa các lần chạy?)
- **Biến phụ thuộc:** (cái gì đo?)
- **Số lần lặp:** (≥ 3 lần, lấy median/mean)
- **Lệnh chạy:** 
- **Output dự kiến:**
```

### 4.3 Kết quả quan sát (Observed Results)

> Điền BẢNG SỐ LIỆU THÔ vào đây. Không làm tròn. Không chọn lọc.

| Lần chạy | Metric A | Metric B | Metric C | Ghi chú |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| Median | | | | |
| Mean | | | | |
| Std | | | | |

### 4.4 Diễn giải (Interpretation)

> Phân tích: tại sao kết quả như vậy? Có khớp giả thuyết không? Sai số từ đâu?

### 4.5 Giới hạn (Limitations)

> Thừa nhận: chỗ nào chưa đo được, chỗ nào thiếu bằng chứng, single-node không đại diện cho production.

---

## 5. Biểu đồ — checklist chất lượng

Mỗi biểu đồ trong báo cáo PHẢI có:

- [ ] **Tên trục X** (kèm đơn vị, ví dụ: "Throughput (records/sec)")
- [ ] **Tên trục Y** (kèm đơn vị)
- [ ] **Legend** (nếu có nhiều series)
- [ ] **Điều kiện đo** (caption: "Đo trên Mac M1, 16GB RAM, batch_size=1000, lặp 5 lần")
- [ ] **Số lần lặp** (n ≥ 3, hiển thị error bar hoặc box plot)
- [ ] **Nguồn dữ liệu** (path file CSV/JSON gốc)

**Ví dụ các biểu đồ cần có:**

| # | Loại biểu đồ | Mục đích | Dữ liệu từ file |
|---|---|---|---|
| 1 | Bar chart | So sánh Bronze/Silver/Gold row counts | |
| 2 | Line chart | Throughput streaming theo thời gian | |
| 3 | Box plot | Latency p50/p95/p99 (3 lần chạy) | |
| 4 | Architecture diagram | Sơ đồ tổng quan | `docs/architecture/ARCHITECTURE.md` |
| 5 | Lineage diagram | Dòng dữ liệu Bronze→Gold | `docs/operations/DATA_LAYOUT.md` |

---

## 6. Demo / Video — checklist

Yêu cầu: chứng minh **luồng bình thường** + **ít nhất 1 tình huống lỗi**.

### 6.1 Happy path (5–7 phút)

| Bước | Thao tác | Thời điểm trong video | Verify |
|---|---|---|---|
| 1 | `make up` — start stack | 0:00 | Logs: tất cả service healthy |
| 2 | Trigger batch retail | 0:30 | Airflow UI: task success |
| 3 | Mở MinIO console → xem Bronze | 1:30 | Có file mới trong bucket |
| 4 | Query Gold từ API | 2:30 | JSON trả về có dữ liệu |
| 5 | Start streaming producer | 3:30 | Kafka UI: messages tăng |
| 6 | Mở UI dashboard | 4:30 | Biểu đồ real-time update |
| 7 | Xem DQ rules | 5:30 | API `/api/dq` trả pass/fail |

### 6.2 Failure scenario (≥ 1 tình huống)

**Ví dụ tình huống lỗi:**

| # | Tình huống | Cách tái tạo | Cách hệ thống xử lý | Bằng chứng |
|---|---|---|---|---|
| F1 | Kafka producer gửi event thiếu field `timestamp` | Tắt `auto.generate.timestamp` trong producer script | Spark streaming skip event malformed, không crash | Log: "Malformed event: ..." |
| F2 | Restart Spark worker giữa chừng | `docker restart lake-spark-worker` | Checkpoint resume từ offset cũ | So sánh row count trước/sau |
| F3 | MinIO down 30s | Stop container MinIO | Pipeline retry, không mất data | Log retry + final success |
| F4 | Bronze có row NULL ở primary key | Inject row NULL vào mock generator | DQ rule fail, task Airflow đỏ | Airflow UI: red task + DQ report |

### 6.3 Lưu ý quan trọng

> **Ảnh chụp giao diện KHÔNG thay thế cho log / số liệu / kịch bản có thể chạy lại.**

- Video phải chạy được lại từ đầu (có script trong `docs/operations/E2E_RUNBOOK.md`).
- Ảnh chụp chỉ là phần bổ sung, không phải bằng chứng chính.
- Log phải copy text đầy đủ, không screenshot chữ nhỏ.

---

## 7. Bảng đo thô — chỗ paste dữ liệu

> Đây là nơi lưu kết quả từ `experiments/`. Mỗi thí nghiệm 1 file CSV/JSON, dán link vào đây.

| Thí nghiệm | File output | Số lần chạy | Ghi chú |
|---|---|---|---|
| Schema evolution | `experiments/output/exp01_*.json` | | |
| ETL vs ELT | `experiments/output/exp02_*.csv` | | |
| Performance bench | `experiments/output/exp03_*.csv` | | |
| Batch correctness | `tests/output/batch_*.json` | | |
| Streaming correctness | `tests/output/stream_*.json` | | |
| Pipeline idempotency | `tests/output/idempotency_*.json` | | |

---

## 8. Acceptance matrix (copy từ Phase 11 audit)

| Yêu cầu | Lệnh verify | Kết quả mong đợi | Kết quả thực tế | PASS/FAIL | Bằng chứng |
|---|---|---|---|---|---|
| Local stack chạy được | `make up && make verify` | All healthy | | | |
| Batch Bronze→Silver→Gold | `make batch` | Row counts khớp | | | |
| Streaming E2E | `make stream` | Events → storage | | | |
| Airflow DAG chạy | Trigger `retail_elt_dag` | Success | | | |
| API health OK | `curl /api/health` | 200 | | | |
| UI build OK | `pnpm build` trong `apps/web/` | Exit 0 | | | |
| Không có secret | `git log -p \| grep -iE 'password\|key\|token'` | 0 hits | | | |
| Docs khớp code | `make verify-docs` | No drift | | | |

---

## 9. Lịch viết báo cáo (gợi ý)

| Thời điểm | Viết phần nào | Phụ trách |
|---|---|---|
| Cuối tuần 3 | §4.1, §4.2 (batch hypothesis + design) | Người A |
| Cuối tuần 4 | §4.3, §4.4 (streaming results) | Người B |
| Cuối tuần 5 | §5, §6 (biểu đồ + demo script) | Người C |
| Cuối tuần 6 | §7, §8 (acceptance matrix) | Cả nhóm review |
| Cuối tuần 7 | §1, §2, §3, §9 (giới thiệu + tổng kết) | Cả nhóm |

---

## 10. Link nhanh tới tài liệu có sẵn

- Plan tổng: [`docs/Ke_hoach_va_prompt_hoan_thien_Data_Lakehouse.md`](../Ke_hoach_va_prompt_hoan_thien_Data_Lakehouse.md)
- Architecture: [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md)
- Data layout: [`docs/operations/DATA_LAYOUT.md`](../operations/DATA_LAYOUT.md)
- Runbook: [`docs/operations/E2E_RUNBOOK.md`](../operations/E2E_RUNBOOK.md)
- Dev links: [`docs/operations/DEV_LINKS.md`](../operations/DEV_LINKS.md)
- Streaming semantics: [`docs/architecture/STREAMING_SEMANTICS.md`](../architecture/STREAMING_SEMANTICS.md)
- Phase reports: [`docs/phases/`](./) và [`docs/audit/`](../audit/)

---

**Ghi nhớ cuối:** Báo cáo tốt = **bằng chứng + diễn giải trung thực**. Tuyệt đối KHÔNG ghi "production-ready", "exactly-once", "real-time" nếu chưa chứng minh được.
