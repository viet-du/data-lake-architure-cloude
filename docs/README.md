# Docs

## Cho developer mới bắt đầu

1. **[DEV_LINKS.md](./operations/DEV_LINKS.md)** — Bảng tất cả URL (UI/API/DB) + quick start
2. **[architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md)** — Diagram & luồng dữ liệu Bronze→Silver→Gold
3. **[operations/DATA_LAYOUT.md](./operations/DATA_LAYOUT.md)** — Schema từng table + cách query

## Operations

- [verify.sh](../../scripts/verify.sh) — Full integrity check (env, deps, compose, files)
- [check_dev_links.sh](../../scripts/check_dev_links.sh) — Health check tất cả dev endpoints
- [Makefile](../../Makefile) — `make help` để xem tất cả targets

## Cấu trúc docs

```
docs/
├── README.md                       # Bạn đang ở đây
├── RULE_BASE                       # Quy tắc contribute
├── architecture/
│   ├── ARCHITECTURE.md             # High-level diagram + layer contracts
│   └── ... (legacy architecture docs)
├── operations/
│   ├── DEV_LINKS.md                # Tất cả URLs
│   ├── DATA_LAYOUT.md              # Schema + queries
│   └── ... (runbooks, ops guides)
├── api/                            # API-specific docs
├── plan/                           # Roadmap, design proposals
├── audit/                          # Audit reports (connection leaks, etc.)
└── archive/                        # Legacy scripts (read-only, đã dừng dùng)
```

## Quick commands

```bash
# 1. Start toàn bộ stack
make up
sleep 60

# 2. Health check
bash scripts/check_dev_links.sh

# 3. Integrity check
make verify

# 4. Chạy tests
make test

# 5. Browse data
open http://localhost:9001  # MinIO console (minioadmin/minioadmin)
```

## Services đang chạy (mặc định)

| Service     | URL                   | Credentials         |
| ----------- | --------------------- | ------------------- |
| MinIO       | http://localhost:9001 | minioadmin/minioadmin |
| Spark       | http://localhost:8080 | -                   |
| Kafka UI    | http://localhost:8081 | -                   |
| Redpanda    | http://localhost:8091 | -                   |
| Airflow     | http://localhost:8088 | admin/admin         |
| Metabase    | http://localhost:3000 | (first-run setup)   |
| MongoDB     | localhost:27017       | mongoadmin/mongoadmin |
| Redis       | localhost:6379       | -                   |

## Tùy chọn (opt-in)

```bash
# Start thêm API + Web UI (cần 5-10 phút build lần đầu)
docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.api.yml up -d
```

| Service | URL                   |
| ------- | --------------------- |
| API     | http://localhost:3001 |
| Web UI  | http://localhost:5173 |
