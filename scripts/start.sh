set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN} Starting Data Lake infrastructure...${NC}"

docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

echo -e "${YELLOW}⏳ Waiting 60s for services to be healthy...${NC}"
sleep 60

echo -e "${GREEN} Infrastructure started!${NC}"
echo
echo " UIs:"
echo "  - MinIO:      http://localhost:9001 (minioadmin/minioadmin)"
echo "  - Spark UI:   http://localhost:8080"
echo "  - Airflow:    http://localhost:8088 (admin/admin)"
echo "  - Kafka UI:   http://localhost:8081"
echo "  - Metabase:   http://localhost:3000"