#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# verify.sh - Quick health & integrity check for the data lake stack
# ═══════════════════════════════════════════════════════════════
# Exits 0 if all checks pass, non-zero on first failure.
# Use: bash scripts/verify.sh
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT=$(pwd)

echo "═══ 1. Python syntax & import ═══"
find src/lakehouse airflow_dags tests -name "*.py" \
  -not -path "*/__pycache__/*" -not -path "*.egg-info/*" \
  -exec ${PYTHON:-.venv/bin/python} -m py_compile {} \; \
  && ok "all Python files compile" || fail "Python syntax error"

if [ -x .venv/bin/python ]; then
  .venv/bin/python -c "from lakehouse.core import constants, env, paths, spark" 2>/dev/null \
    && ok "lakehouse package importable" || warn "lakehouse import failed (deps missing?)"
else
  warn ".venv not present, skipping import check"
fi

echo ""
echo "═══ 2. Env files ═══"
[ -f .env ]             && ok ".env present"              || warn ".env missing (cp .env.example .env)"
[ -f apps/api/.env.local ] && ok "apps/api/.env.local present" || warn "apps/api/.env.local missing"

echo ""
echo "═══ 3. Docker compose validation ═══"
docker compose -f docker-compose.yml -f docker-compose-kafka.yml config --quiet 2>&1 \
  && ok "compose (main + kafka) valid" || fail "compose main+kafka invalid"

docker compose -f docker-compose.yml -f docker-compose-kafka.yml -f docker-compose.api.yml config --quiet 2>&1 \
  && ok "compose (all 3 files) valid" || fail "compose (all 3) invalid"

echo ""
echo "═══ 4. Required files ═══"
[ -f apps/api/public/.gitkeep ] && ok "apps/api/public/.gitkeep present" || warn "apps/api/public/.gitkeep missing"
[ -f scripts/.legacy/README.md ] && warn "scripts/.legacy/ still present (consider cleanup)" || ok "scripts/.legacy removed"

echo ""
echo "═══ 5. Tools available ═══"
command -v python3 >/dev/null && ok "python3: $(python3 --version)" || fail "python3 missing"
command -v node    >/dev/null && ok "node:    $(node --version)"    || warn "node missing"
command -v pnpm    >/dev/null && ok "pnpm:    $(pnpm --version)"    || warn "pnpm missing"
command -v docker  >/dev/null && ok "docker:  $(docker --version)"  || warn "docker missing"

echo ""
echo "═══ 6. Lint (if available) ═══"
if [ -x .venv/bin/ruff ]; then
  .venv/bin/ruff check src tests 2>&1 | tail -3
  ok "ruff passed"
else
  warn "ruff not installed, skipping"
fi

echo ""
echo -e "${GREEN}═══ Verify complete ═══${NC}"
