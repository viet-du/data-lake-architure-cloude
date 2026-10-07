#!/bin/bash
# Khởi động Backend (Next.js API) - Lakehouse
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/apps/api"

export MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/lakehouse_catalog}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export MINIO_ENDPOINT="${MINIO_ENDPOINT:-127.0.0.1:9000}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
export MINIO_SECURE="${MINIO_SECURE:-false}"
export KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP:-127.0.0.1:9092}"
export KAFKA_SECURITY_PROTOCOL="${KAFKA_SECURITY_PROTOCOL:-PLAINTEXT}"
export AIRFLOW_BASE_URL="${AIRFLOW_BASE_URL:-http://127.0.0.1:8088/api/v1}"
export AIRFLOW_USERNAME="${AIRFLOW_USERNAME:-admin}"
export AIRFLOW_PASSWORD="${AIRFLOW_PASSWORD:-admin}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export HOSTNAME="${HOSTNAME:-127.0.0.1}"
export API_PORT="${API_PORT:-3001}"

exec pnpm dev