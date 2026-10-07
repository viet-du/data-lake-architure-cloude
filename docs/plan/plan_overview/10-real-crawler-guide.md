
>  **Mục tiêu**: Hướng dẫn cách crawl dữ liệu **THẬT** từ Tiki.vn, GitHub, CoinGecko, OpenWeather, Hacker News → gửi vào **Kafka** → **Spark Streaming** xử lý → **Delta Lake** lưu trữ.

---


1. [Tổng quan: Crawler + Kafka + Data Lake](#1-tổng-quan)
2. [Hiểu đúng về Kafka](#2-hiểu-đúng-về-kafka)
3. [Crawler Tiki.vn (E-commerce)](#3-crawler-tiki)
4. [Multi-Source Crawler (GitHub/Crypto/Weather/HN)](#4-multi-source)
5. [Spark Streaming xử lý](#5-spark-streaming)
6. [Quick Start](#6-quick-start)
7. [Monitoring & Analytics](#7-monitoring)
8. [Lưu ý pháp lý](#8-lưu-ý-pháp-lý)
9. [Troubleshooting](#9-troubleshooting)

---



```
┌──────────────────────────────────────────────────────────────────┐
│         Real Crawler + Kafka + Data Lake Architecture           │
│                                                                  │
│  CRAWLERS (Producer)            KAFKA (Message Broker)           │
│  ┌──────────┐                   ┌─────────────────────┐         │
│  │   Tiki   │ ──JSON events──► │ ecommerce-products  │         │
│  │  Crawler │                  │ ecommerce-reviews   │         │
│  │          │                  │ ecommerce-prices    │         │
│  └──────────┘                  │ github-trending     │         │
│  ┌──────────┐                  │ crypto-prices       │         │
│  │ GitHub   │ ──JSON events──► │ weather             │         │
│  │ Crypto   │                  │ hackernews          │         │
│  │ Weather  │                  │                     │         │
│  │  Hacker  │                  │  (Topics)           │         │
│  │  News    │                  │                     │         │
│  └──────────┘                  └──────────┬──────────┘         │
│                                            │                    │
│                                            ▼                    │
│  ┌──────────────────────────────────────────────────────┐      │
│  │   SPARK STRUCTURED STREAMING (Consumer)                │      │
│  │   • Read from Kafka                                    │      │
│  │   • Parse JSON                                         │      │
│  │   • Clean, validate, enrich                            │      │
│  │   • Real-time aggregation                              │      │
│  └──────────────────────┬───────────────────────────────┘      │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │   DELTA LAKE (Medallion)                               │      │
│  │    Bronze: Raw data + crawl metadata                │      │
│  │    Silver: Cleaned, normalized, enriched            │      │
│  │    Gold:   Real-time metrics, top products, etc.    │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
│  BI: Looker Studio / Metabase / Streamlit                       │
└──────────────────────────────────────────────────────────────────┘
```


| Aspect | Mock Data (script 08) | Real Crawler (script 09, 10) |
|--------|----------------------|------------------------------|
| **Data source** | Generated tự động | Tiki/GitHub/Crypto API thật |
| **Setup** | 0 phút | 0 phút (cũng free) |
| **Internet** | Không cần | Cần |
| **API key** | Không | Không (đều public) |
| **Rate limit** | Không | Có (cần delay) |
| **Reproducibility** | 100% reproducible | Thay đổi theo thời gian thật |
| **Use case** | Test, demo, đồ án | Production, phân tích thật |
| **Score đồ án** |  |  (ấn tượng hơn) |


```
Mock Data  ──┐
             ├──► Kafka ──► Spark ──► Delta Lake
Real Crawler─┘
```

Chạy song song để vừa demo được tính ổn định, vừa có data thật.

---



Nhiều bạn nhầm lẫn, nhưng:

```
 Kafka KHÔNG crawl data
 Kafka KHÔNG kết nối database  
 Kafka KHÔNG xử lý logic

 Kafka CHỈ truyền message giữa A → B
 Kafka là "bưu tá" / "bưu điện"
```


```
Producer (gửi data) ──► Kafka (truyền) ──► Consumer (nhận + xử lý)
       ↑                                              ↑
       │                                              │
   Crawler                                        Spark Streaming
   Mock Data                                      Database writer
   Sensor                                         Email alert
   API                                            BI dashboard
```

**Kafka giải quyết vấn đề**:
-  Nhiều consumer cùng đọc 1 nguồn (1 producer → N consumer)
-  Lưu trữ tạm thời (Kafka retention 7 ngày mặc định)
-  Replay events khi cần
-  Decoupling giữa producer và consumer


```
Bạn muốn crawl Tiki
  │
  ├─► Viết crawler (script 09) - LẤY DATA từ Tiki API
  │
  ├─► Gửi data vào Kafka (message broker)
  │
  ├─► Spark Streaming ĐỌC từ Kafka
  │
  ├─► Spark xử lý (clean, validate, aggregate)
  │
  └─► Spark GHI vào Delta Lake (Bronze → Silver → Gold)
```

---



-  Crawl products theo **category** (smartphone, laptop, fashion...)
-  Crawl theo **keyword** search
-  Crawl **product details** (giá, rating, reviews, seller)
-  Crawl **flash sale** (realtime deals)
-  Crawl **reviews** của 1 product
-  **Monitor price changes** (track giá theo thời gian)


-  API public, không cần auth
-  JSON response (dễ parse)
-  Data phong phú (giá, rating, reviews, seller, brand)
-  Tốc độ OK (rate limit không quá chặt)
-  Phù hợp đồ án (crawl sàn VN, score cao)


```bash
pip install requests kafka-python
```


```bash
python scripts/09_tiki_crawler.py --category smartphone --max-pages 5

python scripts/09_tiki_crawler.py --mode search --keyword "iphone 15" --max-pages 3

for cat in smartphone laptop tablet tai-nghe fashion-nu my-pham; do
  python scripts/09_tiki_crawler.py --category $cat --max-pages 3
  sleep 5
done

python scripts/09_tiki_crawler.py --mode reviews --product-id 195612559 --max-pages 5

python scripts/09_tiki_crawler.py --mode monitor --product-id 195612559 --interval 60 --duration 3600

python scripts/09_tiki_crawler.py --mode flashsale --max-pages 3
```


**Product từ Tiki**:
```json
{
  "id": 195612559,
  "name": "iPhone 15 Pro Max 256GB",
  "sku": "8901234567890",
  "price": 29990000,
  "original_price": 34990000,
  "discount": 5000000,
  "discount_rate": 14.3,
  "rating_average": 4.7,
  "review_count": 1234,
  "order_count": 5678,
  "brand_name": "Apple",
  "seller_name": "Tiki Trading",
  "category_name": "Điện thoại Smartphone",
  "thumbnail_url": "https://...",
  "_crawl_timestamp": "2024-10-05T22:00:00Z",
  "_source": "tiki.vn"
}
```

**Review**:
```json
{
  "id": 987654,
  "product_id": 195612559,
  "title": "Tuyệt vời!",
  "content": "Sản phẩm dùng rất tốt, pin trâu...",
  "rating": 5,
  "created_by": "user123",
  "thank_count": 42
}
```


```python
time.sleep(1.0)  # Delay 1s giữa các request
time.sleep(0.5)  # Delay giữa các product trong cùng page

python scripts/09_tiki_crawler.py --delay 3.0

```


```bash

curl 'https://tiki.vn/api/v2/products?q=iphone%2015&limit=5' | jq '.data[].id'
```

---



| Source | API | Free? | Rate Limit | Data |
|--------|-----|-------|------------|------|
| **GitHub** | api.github.com |  | 60 req/hr | Trending repos, stars, languages |
| **CoinGecko** | api.coingecko.com |  | 10-30 req/min | Crypto prices, market cap |
| **Open-Meteo** | api.open-meteo.com |  | Unlimited | Weather VN cities |
| **Hacker News** | hacker-news.firebaseio.com |  | Unlimited | Top stories, scores |


```bash
pip install requests kafka-python
```


```bash
python scripts/10_multi_source_crawler.py --source github --language python

python scripts/10_multi_source_crawler.py --source crypto --top-n 100

python scripts/10_multi_source_crawler.py --source weather

python scripts/10_multi_source_crawler.py --source hackernews --max-stories 30

python scripts/10_multi_source_crawler.py --source all

python scripts/10_multi_source_crawler.py --source crypto --monitor --interval 30 --duration 300
```


**GitHub**:
```json
{
  "id": 123456,
  "name": "facebook/react",
  "description": "The library for web and native user interfaces",
  "language": "JavaScript",
  "stars": 220000,
  "forks": 45000,
  "open_issues": 1500,
  "topics": ["react", "frontend", "ui"],
  "created_at": "2013-05-24T16:15:54Z"
}
```

**Crypto (CoinGecko)**:
```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "current_price": 65000,
  "market_cap": 1280000000000,
  "market_cap_rank": 1,
  "total_volume": 25000000000,
  "price_change_percentage_24h": 2.5,
  "high_24h": 66000,
  "low_24h": 64000
}
```

**Weather (Open-Meteo)**:
```json
{
  "city": "hanoi",
  "temperature_c": 28.5,
  "apparent_temperature_c": 32.1,
  "humidity_pct": 75,
  "precipitation_mm": 0.0,
  "wind_speed_kmh": 12.5,
  "weather_code": 1
}
```

**Hacker News**:
```json
{
  "id": 12345,
  "title": "Show HN: I built a Data Lake in a weekend",
  "url": "https://github.com/...",
  "score": 542,
  "by": "user123",
  "descendants": 89,
  "_rank": 5
}
```

---



```
Crawler (Tiki/GitHub/Crypto/Weather)
    │ JSON events
    ▼
Kafka topics (3-7 topics)
    │
    ▼
Spark Structured Streaming (script 11)
    │
    ├─► BRONZE: Raw data + crawl metadata
    │   └─► s3a://bronze/ecommerce/{products|reviews|prices}/
    │
    ├─► SILVER: Cleaned, enriched
    │   ├─► Normalize text (trim, initcap)
    │   ├─► Cast types
    │   ├─► Add derived fields (price_tier, is_on_sale, popularity_score)
    │   ├─► Validate (rating 1-5, price > 0)
    │   └─► Dedup theo id
    │
    └─► GOLD: Real-time metrics
        ├─► Top products per category (5 min window)
        ├─► Price statistics by price_tier
        ├─► Top sellers by orders
        └─► Sentiment analysis (từ reviews)
```


```bash
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py
```


```bash
docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "
    SELECT
      window.start as window_start,
      category_name,
      product_count,
      avg_price,
      avg_rating
    FROM delta.\`s3a://gold/ecommerce/category_metrics/\`
    WHERE window.start > current_timestamp() - INTERVAL 1 HOUR
    ORDER BY window.start DESC, product_count DESC
    LIMIT 20
  "

docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "
    SELECT name, brand_name, price, original_price, discount_rate
    FROM delta.\`s3a://silver/ecommerce/products/\`
    WHERE discount_rate > 30
    ORDER BY discount_rate DESC
    LIMIT 10
  "
```

---



```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

docker ps
```


**Terminal 1: Crawler (sinh data thật)**
```bash
python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

python scripts/10_multi_source_crawler.py --source all
```

**Terminal 2: Spark Streaming (Kafka → Delta Lake)**
```bash
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py
```

**Terminal 3: Query real-time**
```bash
watch -n 10 'docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "SELECT * FROM delta.\`s3a://gold/ecommerce/category_metrics/\` ORDER BY window.start DESC LIMIT 5"'
```


| UI | URL | Xem gì |
|----|-----|--------|
| **Kafka UI** | http://localhost:8081 | Messages đang vào, lag, throughput |
| **MinIO** | http://localhost:9001 | Bronze/Silver/Gold files |
| **Spark UI** | http://localhost:8080 | Streaming jobs đang chạy |


```bash
python scripts/08_mock_data_generator.py --mode stream --rate 10

python scripts/09_tiki_crawler.py --category smartphone --max-pages 5

python scripts/10_multi_source_crawler.py --source crypto --monitor --interval 60 --duration 3600

docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py
```

Bây giờ bạn có **6 Kafka topics** chạy song song:
- `clickstream-events` (mock)
- `ecommerce-products-stream` (Tiki)
- `ecommerce-reviews-stream` (Tiki)
- `ecommerce-price-stream` (Tiki monitor)
- `crypto-prices-stream` (CoinGecko)
- `github-trending-stream` (GitHub)

---



```bash
docker exec lake-kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:29092 \
  --topic ecommerce-products-stream

```


```bash
docker exec lake-minio mc ls --recursive local/bronze/ecommerce/

docker exec lake-minio mc ls --recursive local/silver/ecommerce/

docker exec lake-minio mc ls --recursive local/gold/ecommerce/
```


```python
streamlit run scripts/utils/realtime_dashboard.py
```

Dashboard sẽ show:
- Tổng products crawled
- Tổng reviews crawled
- Top categories
- Top sellers
- Real-time crypto prices
- Weather hiện tại 8 thành phố VN

---



| Hành động | Hợp pháp? | Ghi chú |
|-----------|-----------|---------|
| Crawl **public API** (Tiki, GitHub, CoinGecko) |  | Hợp pháp, nhưng tôn trọng ToS |
| Crawl **HTML trang web** (VnExpress) |  | Cẩn thận, vi phạm ToS có thể bị block |
| Crawl **dữ liệu cá nhân** (PII) |  | Vi phạm GDPR, Nghị định 13/2023 VN |
| Lưu trữ **để phân tích cá nhân** |  | Cần consent |
| **Re-publish** data |  | Vi phạm bản quyền |


-  Tôn trọng **rate limit** (đợi 1-2s giữa các request)
-  Đọc **Terms of Service** trước khi crawl
-  Đặt **User-Agent** rõ ràng (vd: "DataLake-Crawler/1.0 - myemail@example.com")
-  Chỉ crawl **public data** (không cần login)
-  Không **re-publish** raw data (chỉ dùng cho analysis)
-  **Cache** response nếu gọi nhiều lần


```bash
python scripts/09_tiki_crawler.py --delay 5.0


python scripts/10_multi_source_crawler.py --source github  # Không bị chặn
```

---



```bash

python scripts/09_tiki_crawler.py --delay 3.0


```


```bash

export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"

python scripts/10_multi_source_crawler.py --source github --language python  # 1 page
```


```bash
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list

docker exec lake-kafka kafka-topics \
  --bootstrap-server localhost:29092 \
  --create --topic ecommerce-products-stream \
  --partitions 3 --replication-factor 1

python scripts/09_tiki_crawler.py --no-kafka  # Ghi file only, không cần Kafka

docker network inspect datalake-net
```


```bash

.config("spark.databricks.delta.schema.autoMerge.enabled", "true")

.option("mode", "PERMISSIVE")  # Trong readStream
```


```bash
python scripts/09_tiki_crawler.py --delay 0.5

python scripts/09_tiki_crawler.py --category smartphone
python scripts/09_tiki_crawler.py --category laptop
python scripts/09_tiki_crawler.py --category fashion-nu
```

---



 **Kafka KHÔNG crawl data** - chỉ truyền message
 **Crawler thật** từ Tiki, GitHub, Crypto, Weather, HN
 **Không cần API key** cho hầu hết nguồn
 **Tự động gửi vào Kafka** → Spark → Delta Lake
 **Mock data vẫn chạy song song** (kết hợp cả 2)
 **Production-ready** với retry, rate limiting, error handling


| File | Dòng | Mô tả |
|------|------|-------|
| `scripts/09_tiki_crawler.py` | ~430 | Crawler Tiki (5 modes) |
| `scripts/10_multi_source_crawler.py` | ~400 | Crawler GitHub/Crypto/Weather/HN |
| `scripts/11_ecommerce_streaming.py` | ~360 | Spark Streaming xử lý |
| `docs/10-real-crawler-guide.md` | File này | Tài liệu hướng dẫn |


```bash
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py

docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "SELECT * FROM delta.\`s3a://silver/ecommerce/products/\` LIMIT 10"
```

Bạn muốn crawl thêm nguồn nào không? Ví dụ:
- Shopee, Lazada (sàn khác)
- VnExpress, Tuổi Trẻ (tin tức VN)
- Facebook Graph API
- Twitter API
