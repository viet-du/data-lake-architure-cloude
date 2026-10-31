#!/usr/bin/env bash
# =============================================================================
# setup-new-machine.sh — Bootstrap một máy mới vừa `git clone` repo.
#
# Vấn đề mà script này giải quyết:
#   `.env` và `apps/api/.env.local` bị .gitignore (có chứa secret) nên máy mới
#   clone về KHÔNG có file này. `docker compose up` sẽ fail ngay vì
#   (a) env_file: .env không tồn tại, (b) AIRFLOW_FERNET_KEY bắt buộc.
#   Sau đó nếu người dùng điền `R2_*` (như trong .env.example cũ) thì code
#   KHÔNG đọc các biến đó → hệ thống rơi về MinIO localhost:9000 → 403.
#
# Script này tạo đủ file cấu hình với giá trị ĐÚNG TÊN BIẾN mà code thực sự
# đọc, sinh Fernet key hợp lệ, và in ra checklist còn lại.
#
# Usage:
#   ./scripts/setup-new-machine.sh            # interactive
#   ./scripts/setup-new-machine.sh --r2       # cấu hình sẵn cho Cloudflare R2
#   ./scripts/setup-new-machine.sh --minio    # chỉ dùng MinIO local (default)
#
# Idempotent: chạy lại không ghi đè file đã có (trừ khi --force).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

MODE="minio"
FORCE=0
ADMIN_EMAIL="${API_BOOTSTRAP_ADMIN_EMAIL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --r2)    MODE="r2" ;;
    --minio) MODE="minio" ;;
    --force) FORCE=1 ;;
    --admin) shift; ADMIN_EMAIL="${1:-}" ;;
    -h|--help)
      sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

c_reset=$'\033[0m'; c_ok=$'\033[32m'; c_warn=$'\033[33m'; c_err=$'\033[31m'; c_info=$'\033[36m'

log()  { printf '%s==>%s %s\n' "$c_info" "$c_reset" "$*"; }
ok()   { printf '%s  OK%s  %s\n' "$c_ok" "$c_reset" "$*"; }
warn() { printf '%s WARN%s %s\n' "$c_warn" "$c_reset" "$*"; }
err()  { printf '%s FAIL%s %s\n' "$c_err" "$c_reset" "$*"; }
die()  { err "$*"; exit 1; }

# --- guard: secrets must never be committed ----------------------------------
if [[ -z "${PROJECT_ROOT}" ]]; then die "PROJECT_ROOT rỗng"; fi

write_file() {
  local target="$1" content
  content="$(cat)"
  if [[ -f "$target" && $FORCE -eq 0 ]]; then
    warn "$target đã tồn tại — giữ nguyên (dùng --force để ghi đè)"
    return 0
  fi
  printf '%s\n' "$content" > "$target"
  ok "Đã tạo $target"
}

gen_fernet_key() {
  python3 - <<'PY' 2>/dev/null || python3 -c "import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
}

gen_jwt_secret() {
  python3 -c "import secrets;print(secrets.token_urlsafe(48))" 2>/dev/null \
    || head -c 48 /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_'
}

# =============================================================================
# 1. .env  (root — Python lakehouse + Airflow + Spark + compose env_file)
# =============================================================================
log "1/5 — Tạo .env (root)"

if [[ ! -f .env ]]; then
  F=$(gen_fernet_key); J=$(gen_jwt_secret)
  if [[ "$MODE" == "r2" ]]; then
    write_file .env <<EOF
# ── Cloudflare R2 (biến mà code THỰC SỰ ĐỌC: S3_*) ───────────────────────
S3_ENDPOINT=https://REPLACE_WITH_YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY=REPLACE_WITH_R2_ACCESS_KEY_ID
S3_SECRET_KEY=REPLACE_WITH_R2_SECRET_ACCESS_KEY
S3_REGION=auto
S3_USE_SSL=true
S3_PATH_STYLE_ACCESS=true
S3_HEALTH_BUCKET=lakehouse
LAKEHOUSE_BUCKET=lakehouse
EOF
    warn "Đã tạo .env với khung R2 — BẮT BUỘC sửa 3 giá trị REPLACE_* ở trên."
  else
    write_file .env <<EOF
# ── MinIO local (mặc định) ───────────────────────────────────────────────
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
LAKEHOUSE_BUCKET=lakehouse
EOF
  fi
else
  warn ".env đã tồn tại — giữ nguyên"
fi

if [[ ! -f .env ]] || ! grep -q "^AIRFLOW_FERNET_KEY=" .env 2>/dev/null; then
  F=$(gen_fernet_key)
  printf '\nAIRFLOW_FERNET_KEY=%s\n' "$F" >> .env
  ok "Đã thêm AIRFLOW_FERNET_KEY vào .env"
fi

# =============================================================================
# 2. apps/api/.env.local  (Next.js API — đọc bởi env-loader.js / apply-env.ts)
# =============================================================================
log "2/5 — Tạo apps/api/.env.local"

if [[ ! -f apps/api/.env.local ]]; then
  J=$(gen_jwt_secret)
  cat > apps/api/.env.local <<EOF
ENV=local
LOG_LEVEL=info

# MongoDB bật auth (root mongoadmin/mongoadmin). Chạy API trên HOST thì cần
# authSource=admin; trong Docker compose sẽ được override thành @mongo:27017.
MONGO_URI=mongodb://mongoadmin:mongoadmin@127.0.0.1:27017/?authSource=admin
MONGO_DB=lakehouse_catalog

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

KAFKA_BOOTSTRAP=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT

# Origin của web dev = 5173 (3000 là Metabase).
API_CORS_ORIGINS=http://localhost:5173,http://localhost:3001
API_SWAGGER_ENABLED=true
API_PORT=3001
API_RATE_LIMIT_PER_MIN=600

# Auth. Bật = true thì phải bootstrap admin (xem checklist cuối output).
API_AUTH_ENABLED=true
API_JWT_SECRET=$J

# Storage: để trống = dùng MINIO_*. Muốn dùng R2 thì bỏ comment 6 dòng dưới.
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
# S3_ENDPOINT=https://REPLACE_WITH_YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
# S3_ACCESS_KEY=REPLACE_WITH_R2_ACCESS_KEY_ID
# S3_SECRET_KEY=REPLACE_WITH_R2_SECRET_ACCESS_KEY
# S3_REGION=auto
# S3_PATH_STYLE_ACCESS=true
# S3_USE_SSL=true
# S3_HEALTH_BUCKET=lakehouse
LAKEHOUSE_BUCKET=lakehouse

DUCKDB_MEMORY_LIMIT=4GB
DUCKDB_THREADS=4
EOF
  ok "Đã tạo apps/api/.env.local"
else
  warn "apps/api/.env.local đã tồn tại — giữ nguyên"
fi

# =============================================================================
# 3. apps/api/.env.local — copy cảnh báo bootstrap admin
# =============================================================================
log "3/5 — Ghi chú bootstrap admin"
cat >> apps/api/.env.local <<'EOF'

# ── Bootstrap admin (chỉ dùng lần đầu, MongoDB còn rỗng) ──────────────────
# Không đặt mật khẩu ở đây. Chạy lệnh sau với biến môi trường:
#
#   export API_BOOTSTRAP_ADMIN_EMAIL="<email-của-bạn>"
#   export API_BOOTSTRAP_ADMIN_PASSWORD="<mật-khẩu-≥32-ký-tự>"
#   pnpm --filter lakehouse-api security:bootstrap
#
# "Add admin" trên GitHub KHÔNG tạo được user trong hệ thống này:
# user nằm trong MongoDB collection `control_plane_users` của từng máy.
EOF
ok "Đã ghi hướng dẫn bootstrap vào apps/api/.env.local"

# =============================================================================
# 4. .gitignore check — đảm bảo secret không bị commit nhầm
# =============================================================================
log "4/5 — Kiểm tra .gitignore"
MISSING=()
for f in ".env" "apps/api/.env.local" "R2_ENV_KEYS.txt"; do
  if ! git check-ignore -q "$f" 2>/dev/null; then MISSING+=("$f"); fi
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  warn "Các file sau KHÔNG được gitignore — kiểm tra lại: ${MISSING[*]}"
else
  ok ".env, apps/api/.env.local, R2_ENV_KEYS.txt đều đã gitignore"
fi

# =============================================================================
# 5. Validate: compose config phải parse được
# =============================================================================
log "5/5 — Validate docker compose config"
if command -v docker >/dev/null 2>&1; then
  if docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml config --quiet >/dev/null 2>&1; then
    ok "docker compose config hợp lệ"
  else
    err "docker compose config FAIL — chạy lại lệnh sau để xem chi tiết:"
    printf '    docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.dev-api.yml config\n'
  fi
else
  warn "Không tìm thấy docker — bỏ qua validate compose"
fi

# =============================================================================
# Checklist
# =============================================================================
cat <<'CHECKLIST'

────────────────────────────────────────────────────────────────────────────
 CHECKLIST SAU KHI CHẠY SCRIPT NÀY
────────────────────────────────────────────────────────────────────────────

 1. [ ] Cài dependencies
        pnpm install

 2. [ ] Build images (lần đầu khá lâu)
        make build

 3. [ ] Khởi động stack
        make up
        # hoặc chỉ phần API: make up-api

 4. [ ] TẠO BUCKET "lakehouse" — minio-init KHÔNG tạo bucket này.
        Đây là nguyên nhân phổ biến nhất của lỗi NoSuchBucket:
        docker exec lake-minio sh -c 'mc alias set local http://minio:9000 minioadmin minioadmin && mc mb --ignore-existing local/lakehouse && mc ls local/'

    Nếu dùng Cloudflare R2: tạo bucket tên "lakehouse" trong R2 dashboard
    (Region: auto, Object Read & Write) — KHÔNG tạo 3 bucket bronze/silver/gold,
    vì toàn bộ đường dẫn là s3a://lakehouse/{layer}/{database}/{table}.

 5. [ ] Bootstrap admin (MongoDB trên máy mới luôn rỗng)
        export API_BOOTSTRAP_ADMIN_EMAIL="<email-của-bạn>"
        export API_BOOTSTRAP_ADMIN_PASSWORD="<mật-khẩu-≥32-ký-tự>"
        pnpm --filter lakehouse-api security:bootstrap

 6. [ ] Nếu dùng R2: điền S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY
        trong .env VÀ apps/api/.env.local, rồi kiểm tra:
        ./scripts/test_r2_connection.sh

 7. [ ] Kiểm tra sức khoẻ
        curl -s http://localhost:3001/api/health/deep | head -50

────────────────────────────────────────────────────────────────────────────
 LỖI THƯỜNG GẶP
────────────────────────────────────────────────────────────────────────────
 403 / AccessDenied ........... Token R2 sai, hoặc thiếu quyền "Object Read & Write",
                               hoặc bucket "lakehouse" chưa tạo.
 10000 (wrangler) ............ Chưa `wrangler login` / sai account.
                               `wrangler logout && wrangler login && wrangler whoami`
 NoSuchBucket ................ Thiếu bucket "lakehouse" (bước 4).
 Login bị từ chối ............ Chưa chạy bootstrap (bước 5), hoặc
                               API_AUTH_ENABLED=false trong .env.local.
 CORS error trên trình duyệt .. API_CORS_ORIGINS thiếu http://localhost:5173.
 "S3_ACCESS_KEY and S3_SECRET_KEY are required when S3_ENDPOINT is set"
                            .... Đặt S3_ENDPOINT nhưng bỏ trống key.
CHECKLIST
