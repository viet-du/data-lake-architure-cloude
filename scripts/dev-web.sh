#!/bin/bash
# Khởi động Frontend (Vite + React) - Lakehouse
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/apps/web"
exec pnpm dev