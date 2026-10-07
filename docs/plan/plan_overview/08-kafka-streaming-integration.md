
Kafka là message broker, **không phải crawler**. Trong project này, Kafka đóng vai trò truyền message giữa Producer (crawler/mock) và Consumer (Spark Streaming).


```
Crawler/Mock ──► Kafka ──► Spark Streaming ──► Delta Lake
   Producer       Broker         Consumer
```


```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list
```


```bash
python scripts/05_kafka_producer.py --rate 10

python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

python scripts/10_multi_source_crawler.py --source all
```


```bash
docker exec lake-spark-master spark-submit \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/06_kafka_to_bronze_streaming.py

docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/07_aggregate_clickstream_gold.py
```


| Topic | Source | Use case |
|-------|--------|----------|
| clickstream-events | Mock | Web analytics |
| ecommerce-products-stream | Tiki | Product tracking |
| ecommerce-reviews-stream | Tiki | Sentiment analysis |
| ecommerce-price-stream | Tiki monitor | Price tracking |
| crypto-prices-stream | CoinGecko | Crypto dashboard |
| github-trending-stream | GitHub | Tech trends |
| weather-stream | Open-Meteo | Weather analytics |
| hackernews-stream | HN | News trends |


- **Kafka UI**: http://localhost:8081
- Xem messages, lag, throughput
