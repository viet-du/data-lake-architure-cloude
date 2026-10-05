# 08 – Tích hợp Kafka + Spark Streaming

Kafka là message broker, **không phải crawler**. Trong project này, Kafka đóng vai trò truyền message giữa Producer (crawler/mock) và Consumer (Spark Streaming).

## 1. Kiến trúc

```
Crawler/Mock ──► Kafka ──► Spark Streaming ──► Delta Lake
   Producer       Broker         Consumer
```

## 2. Setup Kafka

```bash
# Khởi động Kafka
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

# Verify topics
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list
```

## 3. Producer

```bash
# Clickstream (mock)
python scripts/05_kafka_producer.py --rate 10

# Real crawler (Tiki)
python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

# Multi-source
python scripts/10_multi_source_crawler.py --source all
```

## 4. Spark Streaming

```bash
# Kafka → Bronze
docker exec lake-spark-master spark-submit \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/06_kafka_to_bronze_streaming.py

# Silver + Gold
docker exec lake-spark-master spark-submit \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  /scripts/07_aggregate_clickstream_gold.py
```

## 5. Topics & Use case

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

## 6. UI

- **Kafka UI**: http://localhost:8081
- Xem messages, lag, throughput
