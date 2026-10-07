
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=============================================================${NC}"
echo -e "${GREEN}  Data Lake Architecture - Quick Start${NC}"
echo -e "${GREEN}=============================================================${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED} Docker not installed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Installing Python packages...${NC}"
pip3 install --quiet pandas pyarrow boto3 pyspark delta-spark kafka-python 2>/dev/null || true

echo -e "\n${YELLOW}Starting Docker stack...${NC}"
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
echo "Waiting 60s for services..."
sleep 60

echo -e "\n${YELLOW}Generating mock data...${NC}"
python3 scripts/08_mock_data_generator.py --mode batch --customers 500 --products 100 --orders 2000

echo -e "\n${YELLOW}Running ETL pipeline...${NC}"
python3 scripts/01_ingest_to_bronze.py 2>&1 | tail -3

echo -e "\n${YELLOW}Spark jobs (Silver + Gold)...${NC}"
docker exec lake-spark-master spark-submit \
    --master spark://spark-master:7077 \
    --packages io.delta:delta-spark_2.12:3.0.0 \
    /scripts/02_transform_to_silver.py 2>&1 | tail -3

docker exec lake-spark-master spark-submit \
    --master spark://spark-master:7077 \
    --packages io.delta:delta-spark_2.12:3.0.0 \
    /scripts/03_aggregate_to_gold.py 2>&1 | tail -3

echo -e "\n${GREEN}=============================================================${NC}"
echo -e "${GREEN} Data Lake Setup Complete!${NC}"
echo -e "${GREEN}=============================================================${NC}"
echo ""
echo " UI:"
echo "   - MinIO:     http://localhost:9001 (minioadmin/minioadmin)"
echo "   - Spark:     http://localhost:8080"
echo "   - Airflow:   http://localhost:8088 (admin/admin)"
echo "   - Kafka UI:  http://localhost:8081"
echo "   - Metabase:  http://localhost:3000"
echo ""
echo " Stop: docker-compose -f docker-compose.yml -f docker-compose-kafka.yml down"
