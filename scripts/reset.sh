set -euo pipefail

YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}  DESTRUCTIVE — this will DELETE ALL DATA${NC}"
echo "  - Removes Docker volumes (MinIO, Postgres, Airflow DB, Kafka, Mongo, Redis, ...)"
echo "  - Removes all files under data-samples/"
echo "  - Restarts the core stack from scratch"
echo
echo -e "${RED}  Step 1/2 — type yes to continue:${NC}"
read -p "  > " first
if [ "$first" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo
echo -e "${RED}  Step 2/2 — type RESET to confirm the data wipe:${NC}"
read -p "  > " second
if [ "$second" != "RESET" ]; then
  echo "Aborted."
  exit 0
fi

echo
echo -e "${YELLOW}  Removing Docker volumes...${NC}"
docker compose -f docker-compose.yml -f docker-compose-kafka.yml down -v

echo -e "${YELLOW}  Removing mock data...${NC}"
rm -rf data-samples/*

echo -e "${YELLOW}  Restarting...${NC}"
./scripts/start.sh
