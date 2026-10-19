#!/usr/bin/env bash
# ============================================================================
# scripts/check_dev_links.sh
# ----------------------------------------------------------------------------
# Quick health check for all dev endpoints listed in docs/operations/DEV_LINKS.md
# Exits 0 if all critical services respond, 1 if any required service is down.
#
# Usage:  bash scripts/check_dev_links.sh
#         bash scripts/check_dev_links.sh --verbose   # show response bodies
#         bash scripts/check_dev_links.sh --only web   # check only matching group
# ============================================================================

set -uo pipefail

VERBOSE=0
ONLY_FILTER=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --verbose|-v) VERBOSE=1; shift ;;
        --only)       ONLY_FILTER="$2"; shift 2 ;;
        *)            echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

# ---- Service catalog ----
# format: group|name|host:port|path|method|critical|description
# (expected_codes removed; we accept 200/301/302)
SERVICES=(
    # Storage
    "storage|minio-api|localhost:9000|/minio/health/live|http|critical|MinIO S3 API"
    "storage|minio-console|localhost:9001|/|http|critical|MinIO Web Console"
    "storage|spark-master|localhost:8080|/|http|critical|Spark Master UI"
    # Streaming (Confluent Kafka, defined in docker-compose-kafka.yml)
    "streaming|kafka-broker|localhost:9092||tcp|info|Kafka broker (port only)"
    "streaming|kafka-ui|localhost:8081|/|http|critical|Kafka UI (Confluent)"
    # Orchestration
    "orchestration|airflow|localhost:8088|/api/v1/health|http|critical|Airflow webserver"
    # App layer (opt-in: make up-api)
    "app|api|localhost:3001|/api/health|http|optional|Next.js API"
    "app|web|localhost:5173|/|http|optional|React Web UI"
    # Auxiliary
    "aux|mongodb|localhost:27017||tcp|optional|MongoDB"
    "aux|redis|localhost:6379||tcp|optional|Redis"
    "aux|metabase|localhost:3000|/api/health|http|optional|Metabase BI"
)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
SKIP=0
CRIT_FAIL=0

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        Data Lakehouse — Dev Endpoint Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Print one service result
check_http() {
    local name="$1" url="$2" critical="$3" desc="$4"
    local response
    response=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>&1) || response="000"
    if [[ "$response" =~ ^(200|301|302)$ ]]; then
        echo -e "  ${GREEN}✓${NC}  ${name}  (${response})  ${desc}"
        PASS=$((PASS+1))
    else
        if [[ "$critical" == "critical" ]]; then
            echo -e "  ${RED}✗${NC}  ${name}  (${response})  ${desc}  [REQUIRED]"
            FAIL=$((FAIL+1))
            CRIT_FAIL=$((CRIT_FAIL+1))
        else
            echo -e "  ${YELLOW}!${NC}  ${name}  (${response})  ${desc}  [optional]"
            SKIP=$((SKIP+1))
        fi
    fi
    if [[ "$VERBOSE" -eq 1 && "$response" =~ ^[23] ]]; then
        curl -s --max-time 3 "$url" 2>/dev/null | head -3
    fi
}

check_tcp() {
    local name="$1" host="$2" port="$3" critical="$4" desc="$5"
    if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC}  ${name}  (open)  ${desc}"
        PASS=$((PASS+1))
    else
        if [[ "$critical" == "critical" ]]; then
            echo -e "  ${RED}✗${NC}  ${name}  (closed)  ${desc}  [REQUIRED]"
            FAIL=$((FAIL+1))
            CRIT_FAIL=$((CRIT_FAIL+1))
        else
            echo -e "  ${YELLOW}!${NC}  ${name}  (closed)  ${desc}  [optional]"
            SKIP=$((SKIP+1))
        fi
    fi
}

# Iterate
current_group=""
for line in "${SERVICES[@]}"; do
    IFS='|' read -r group name addr path method critical desc <<< "$line"

    # Group filter
    if [[ -n "$ONLY_FILTER" && "$group" != *"$ONLY_FILTER"* ]]; then
        continue
    fi

    if [[ "$current_group" != "$group" ]]; then
        echo -e "\n${BLUE}─── ${group} ───${NC}"
        current_group="$group"
    fi

    if [[ "$method" == "http" ]]; then
        url="http://${addr}${path}"
        check_http "$name" "$url" "$critical" "$desc"
    elif [[ "$method" == "tcp" ]]; then
        host="${addr%:*}"
        port="${addr##*:}"
        check_tcp "$name" "$host" "$port" "$critical" "$desc"
    fi
done

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}pass:  ${PASS}${NC}"
if [[ "$FAIL" -gt 0 ]]; then
    echo -e "  ${RED}fail:  ${FAIL}${NC} (${CRIT_FAIL} critical)"
else
    echo -e "  fail:  0"
fi
if [[ "$SKIP" -gt 0 ]]; then
    echo -e "  ${YELLOW}skip:  ${SKIP}${NC} (optional services down)"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ "$CRIT_FAIL" -gt 0 ]]; then
    echo -e "${RED}❌  One or more CRITICAL services are down.${NC}"
    echo "    Check status with:  docker ps"
    echo "    Or restart:         make down && make up"
    exit 1
fi

echo -e "${GREEN}✅  All critical services are up.${NC}"
echo "    See docs/operations/DEV_LINKS.md for full reference."
exit 0
