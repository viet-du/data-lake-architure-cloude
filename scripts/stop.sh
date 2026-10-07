set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}⏹  Stopping Data Lake infrastructure...${NC}"
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml down
echo -e "${GREEN} Stopped!${NC}"