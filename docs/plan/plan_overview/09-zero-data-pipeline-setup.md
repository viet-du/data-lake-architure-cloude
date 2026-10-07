
Không cần data thật! Mock Data Generator sinh tất cả.


```bash
chmod +x quickstart.sh
./quickstart.sh
```


```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

python scripts/08_mock_data_generator.py --mode batch --customers 500 --products 100 --orders 2000

python scripts/01_ingest_to_bronze.py
docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/02_transform_to_silver.py
docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/03_aggregate_to_gold.py

```


| Mode | Output | Use case |
|------|--------|----------|
| `--mode batch` | CSV/JSON files | ETL pipeline |
| `--mode stream` | Kafka + file | Real-time pipeline |
| `--mode iot` | IoT sensor data | IoT analytics |
| `--mode logs` | Web logs | Log analysis |
| `--mode all` | Tất cả | Full demo |


 VN-style data (tên, thành phố VN)
 Business logic (VIP mua nhiều hơn)
 Dirty data cố ý (5%) để test DQ
 Realistic event distribution
 Reproducible (random.seed(42))
