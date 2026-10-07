set -euo pipefail

YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}  This will delete ALL data (MinIO volumes, mock data, logs)${NC}"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo -e "${YELLOW}  Removing Docker volumes...${NC}"
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml down -v

echo -e "${YELLOW}  Removing mock data...${NC}"
rm -rf data-samples/*

echo -e "${YELLOW} Restarting...${NC}"
./scripts/start.sh