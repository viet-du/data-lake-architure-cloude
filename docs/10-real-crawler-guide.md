# 10 – Crawler thật: Tiki + GitHub + Crypto + Weather → Kafka → Data Lake

> 🎯 **Mục tiêu**: Hướng dẫn cách crawl dữ liệu **THẬT** từ Tiki.vn, GitHub, CoinGecko, OpenWeather, Hacker News → gửi vào **Kafka** → **Spark Streaming** xử lý → **Delta Lake** lưu trữ.

---

## 📋 Mục lục

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

## 1. Tổng quan: Crawler + Kafka + Data Lake

### 1.1. Kiến trúc

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
│  │   🥉 Bronze: Raw data + crawl metadata                │      │
│  │   🥈 Silver: Cleaned, normalized, enriched            │      │
│  │   🥇 Gold:   Real-time metrics, top products, etc.    │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
│  BI: Looker Studio / Metabase / Streamlit                       │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2. So sánh Mock vs Real Crawler

| Aspect | Mock Data (script 08) | Real Crawler (script 09, 10) |
|--------|----------------------|------------------------------|
| **Data source** | Generated tự động | Tiki/GitHub/Crypto API thật |
| **Setup** | 0 phút | 0 phút (cũng free) |
| **Internet** | Không cần | Cần |
| **API key** | Không | Không (đều public) |
| **Rate limit** | Không | Có (cần delay) |
| **Reproducibility** | 100% reproducible | Thay đổi theo thời gian thật |
| **Use case** | Test, demo, đồ án | Production, phân tích thật |
| **Score đồ án** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (ấn tượng hơn) |

### 1.3. Có thể dùng cả 2

```
Mock Data  ──┐
             ├──► Kafka ──► Spark ──► Delta Lake
Real Crawler─┘
```

Chạy song song để vừa demo được tính ổn định, vừa có data thật.

---

## 2. Hiểu đúng về Kafka

### 2.1. Kafka KHÔNG phải crawler

Nhiều bạn nhầm lẫn, nhưng:

```
❌ Kafka KHÔNG crawl data
❌ Kafka KHÔNG kết nối database  
❌ Kafka KHÔNG xử lý logic

✅ Kafka CHỈ truyền message giữa A → B
✅ Kafka là "bưu tá" / "bưu điện"
```

### 2.2. Vai trò đúng trong pipeline

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
- ✅ Nhiều consumer cùng đọc 1 nguồn (1 producer → N consumer)
- ✅ Lưu trữ tạm thời (Kafka retention 7 ngày mặc định)
- ✅ Replay events khi cần
- ✅ Decoupling giữa producer và consumer

### 2.3. Flow thực tế cho đồ án

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

## 3. Crawler Tiki (E-commerce)

### 3.1. Tính năng

- ✅ Crawl products theo **category** (smartphone, laptop, fashion...)
- ✅ Crawl theo **keyword** search
- ✅ Crawl **product details** (giá, rating, reviews, seller)
- ✅ Crawl **flash sale** (realtime deals)
- ✅ Crawl **reviews** của 1 product
- ✅ **Monitor price changes** (track giá theo thời gian)

### 3.2. Tại sao chọn Tiki?

- ✅ API public, không cần auth
- ✅ JSON response (dễ parse)
- ✅ Data phong phú (giá, rating, reviews, seller, brand)
- ✅ Tốc độ OK (rate limit không quá chặt)
- ✅ Phù hợp đồ án (crawl sàn VN, score cao)

### 3.3. Cài đặt

```bash
pip install requests kafka-python
```

### 3.4. Chạy crawler

```bash
# 1. Crawl theo category (5 pages × 40 products = ~200 products)
python scripts/09_tiki_crawler.py --category smartphone --max-pages 5

# 2. Crawl theo keyword search
python scripts/09_tiki_crawler.py --mode search --keyword "iphone 15" --max-pages 3

# 3. Crawl tất cả categories (chậm, ~10 phút)
for cat in smartphone laptop tablet tai-nghe fashion-nu my-pham; do
  python scripts/09_tiki_crawler.py --category $cat --max-pages 3
  sleep 5
done

# 4. Crawl reviews của 1 product
python scripts/09_tiki_crawler.py --mode reviews --product-id 195612559 --max-pages 5

# 5. Monitor giá 5 sản phẩm, mỗi 60s, trong 1 giờ
python scripts/09_tiki_crawler.py --mode monitor --product-id 195612559 --interval 60 --duration 3600

# 6. Crawl flash sale
python scripts/09_tiki_crawler.py --mode flashsale --max-pages 3
```

### 3.5. Data schema

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

### 3.6. Rate limit & Best practices

```python
# Trong code đã có sẵn:
time.sleep(1.0)  # Delay 1s giữa các request
time.sleep(0.5)  # Delay giữa các product trong cùng page

# Nếu bị rate limit (403), tăng delay:
python scripts/09_tiki_crawler.py --delay 3.0

# Best practices:
# ✅ Không crawl quá 1000 products/giờ
# ✅ Dùng User-Agent giả lập browser (đã có sẵn)
# ✅ Retry tự động khi fail (đã có sẵn)
# ✅ Cache response nếu cần (chưa có, có thể thêm)
```

### 3.7. Tìm product ID

```bash
# Cách 1: Vào tiki.vn, click vào sản phẩm, xem URL
# https://tiki.vn/apple-iphone-15-pro-max-256gb-p195612559.html
#                                              ^^^^^^^^^ ID ở đây

# Cách 2: Dùng search API
curl 'https://tiki.vn/api/v2/products?q=iphone%2015&limit=5' | jq '.data[].id'
```

---

## 4. Multi-Source Crawler

### 4.1. Tổng quan 4 nguồn

| Source | API | Free? | Rate Limit | Data |
|--------|-----|-------|------------|------|
| **GitHub** | api.github.com | ✅ | 60 req/hr | Trending repos, stars, languages |
| **CoinGecko** | api.coingecko.com | ✅ | 10-30 req/min | Crypto prices, market cap |
| **Open-Meteo** | api.open-meteo.com | ✅ | Unlimited | Weather VN cities |
| **Hacker News** | hacker-news.firebaseio.com | ✅ | Unlimited | Top stories, scores |

### 4.2. Cài đặt

```bash
pip install requests kafka-python
```

### 4.3. Chạy

```bash
# 1. Crawl GitHub trending (Python repos, top tuần này)
python scripts/10_multi_source_crawler.py --source github --language python

# 2. Crawl top 100 crypto
python scripts/10_multi_source_crawler.py --source crypto --top-n 100

# 3. Crawl weather 8 thành phố VN
python scripts/10_multi_source_crawler.py --source weather

# 4. Crawl top 30 Hacker News stories
python scripts/10_multi_source_crawler.py --source hackernews --max-stories 30

# 5. Crawl TẤT CẢ (chạy 1 lần)
python scripts/10_multi_source_crawler.py --source all

# 6. Monitor crypto prices real-time (30s interval, 5 phút)
python scripts/10_multi_source_crawler.py --source crypto --monitor --interval 30 --duration 300
```

### 4.4. Data schema cho từng nguồn

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

## 5. Spark Streaming xử lý

### 5.1. Pipeline tổng thể

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

### 5.2. Chạy Spark job

```bash
# Terminal riêng, chạy 1 lần (availableNow=True)
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py
```

### 5.3. Query Gold layer

```bash
# Top categories trong 1 giờ qua
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

# Best deals (discount cao nhất)
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

## 6. Quick Start

### 6.1. Setup infrastructure (1 lần)

```bash
# Khởi động tất cả services
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d
sleep 60

# Verify
docker ps
```

### 6.2. Chạy đầy đủ pipeline (3 terminals)

**Terminal 1: Crawler (sinh data thật)**
```bash
# Crawl Tiki smartphone
python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

# Hoặc tất cả sources
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
# Xem data trong Gold
watch -n 10 'docker exec lake-spark-master spark-sql \
  --master spark://spark-master:7077 \
  --packages io.delta:delta-spark_2.12:3.0.0 \
  -e "SELECT * FROM delta.\`s3a://gold/ecommerce/category_metrics/\` ORDER BY window.start DESC LIMIT 5"'
```

### 6.3. Monitor qua UI

| UI | URL | Xem gì |
|----|-----|--------|
| **Kafka UI** | http://localhost:8081 | Messages đang vào, lag, throughput |
| **MinIO** | http://localhost:9001 | Bronze/Silver/Gold files |
| **Spark UI** | http://localhost:8080 | Streaming jobs đang chạy |

### 6.4. Chạy kết hợp Mock + Real

```bash
# Terminal 1: Mock data (clickstream)
python scripts/08_mock_data_generator.py --mode stream --rate 10

# Terminal 2: Real crawler (Tiki)
python scripts/09_tiki_crawler.py --category smartphone --max-pages 5

# Terminal 3: Real crawler (Crypto)
python scripts/10_multi_source_crawler.py --source crypto --monitor --interval 60 --duration 3600

# Terminal 4: Spark Streaming (xử lý TẤT CẢ Kafka topics)
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

## 7. Monitoring & Analytics

### 7.1. Track từng nguồn

```bash
# Đếm messages trong từng Kafka topic
docker exec lake-kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:29092 \
  --topic ecommerce-products-stream

# Output: ecommerce-products-stream:0:1523
#         ecommerce-products-stream:1:1456
#         ecommerce-products-stream:2:1389
# Tổng: 4368 messages
```

### 7.2. Xem data mẫu trong từng layer

```bash
# Bronze
docker exec lake-minio mc ls --recursive local/bronze/ecommerce/

# Silver (sau khi Spark stream chạy)
docker exec lake-minio mc ls --recursive local/silver/ecommerce/

# Gold
docker exec lake-minio mc ls --recursive local/gold/ecommerce/
```

### 7.3. Real-time metrics dashboard

```python
# scripts/utils/realtime_dashboard.py
# Chạy Streamlit dashboard update mỗi 10s
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

## 8. Lưu ý pháp lý

### 8.1. Có hợp pháp không?

| Hành động | Hợp pháp? | Ghi chú |
|-----------|-----------|---------|
| Crawl **public API** (Tiki, GitHub, CoinGecko) | ✅ | Hợp pháp, nhưng tôn trọng ToS |
| Crawl **HTML trang web** (VnExpress) | ⚠️ | Cẩn thận, vi phạm ToS có thể bị block |
| Crawl **dữ liệu cá nhân** (PII) | ❌ | Vi phạm GDPR, Nghị định 13/2023 VN |
| Lưu trữ **để phân tích cá nhân** | ⚠️ | Cần consent |
| **Re-publish** data | ❌ | Vi phạm bản quyền |

### 8.2. Best practices

- ✅ Tôn trọng **rate limit** (đợi 1-2s giữa các request)
- ✅ Đọc **Terms of Service** trước khi crawl
- ✅ Đặt **User-Agent** rõ ràng (vd: "DataLake-Crawler/1.0 - myemail@example.com")
- ✅ Chỉ crawl **public data** (không cần login)
- ✅ Không **re-publish** raw data (chỉ dùng cho analysis)
- ✅ **Cache** response nếu gọi nhiều lần

### 8.3. Nếu bị chặn

```bash
# Tăng delay
python scripts/09_tiki_crawler.py --delay 5.0

# Rotate User-Agent (cần custom code)
# Dùng proxy (không khuyến nghị cho đồ án)

# Đổi sang nguồn khác
python scripts/10_multi_source_crawler.py --source github  # Không bị chặn
```

---

## 9. Troubleshooting

### 9.1. Tiki trả về 403

```bash
# Lỗi: "Bạn đã gửi quá nhiều request"

# Fix 1: Tăng delay
python scripts/09_tiki_crawler.py --delay 3.0

# Fix 2: Headers không đầy đủ
# Script đã có sẵn headers giả lập browser, nếu vẫn fail thì:
# - Update User-Agent trong script
# - Clear cookies: docker exec lake-kafka rm -rf /tmp/cookies

# Fix 3: IP bị block tạm thời
# - Chờ 1 giờ rồi thử lại
# - Dùng VPN
```

### 9.2. GitHub rate limit

```bash
# Lỗi: "API rate limit exceeded for xxx.xxx.xxx.xxx. (60 requests/hr)"

# Fix 1: Thêm GitHub token (free)
# Vào https://github.com/settings/tokens
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
# Trong script 10, thêm header:
# self.session.headers["Authorization"] = f"Bearer {os.getenv('GITHUB_TOKEN')}"
# Tăng limit lên 5000 req/hr

# Fix 2: Crawl ít hơn
python scripts/10_multi_source_crawler.py --source github --language python  # 1 page
```

### 9.3. Kafka không nhận message

```bash
# Check 1: Kafka topics tồn tại
docker exec lake-kafka kafka-topics --bootstrap-server localhost:29092 --list

# Nếu thiếu topic ecommerce-products-stream:
docker exec lake-kafka kafka-topics \
  --bootstrap-server localhost:29092 \
  --create --topic ecommerce-products-stream \
  --partitions 3 --replication-factor 1

# Check 2: Producer gửi OK?
python scripts/09_tiki_crawler.py --no-kafka  # Ghi file only, không cần Kafka
# Nếu file có data → Kafka là vấn đề
# Nếu file rỗng → Crawler là vấn đề

# Check 3: Network
docker network inspect datalake-net
```

### 9.4. Spark job fail với schema error

```bash
# Lỗi: "Cannot parse JSON: field 'price' has type STRING but expected DOUBLE"

# Fix: Bật schema auto-merge
.config("spark.databricks.delta.schema.autoMerge.enabled", "true")
# (Đã có trong script)

# Hoặc thêm permissive mode
.option("mode", "PERMISSIVE")  # Trong readStream
```

### 9.5. Crawler quá chậm

```bash
# Giảm delay
python scripts/09_tiki_crawler.py --delay 0.5

# Tăng parallelism (chạy nhiều crawler cùng lúc)
# Terminal 1
python scripts/09_tiki_crawler.py --category smartphone
# Terminal 2
python scripts/09_tiki_crawler.py --category laptop
# Terminal 3
python scripts/09_tiki_crawler.py --category fashion-nu
```

---

## 🎓 Kết luận

### Tóm tắt

✅ **Kafka KHÔNG crawl data** - chỉ truyền message
✅ **Crawler thật** từ Tiki, GitHub, Crypto, Weather, HN
✅ **Không cần API key** cho hầu hết nguồn
✅ **Tự động gửi vào Kafka** → Spark → Delta Lake
✅ **Mock data vẫn chạy song song** (kết hợp cả 2)
✅ **Production-ready** với retry, rate limiting, error handling

### File mới tạo

| File | Dòng | Mô tả |
|------|------|-------|
| `scripts/09_tiki_crawler.py` | ~430 | Crawler Tiki (5 modes) |
| `scripts/10_multi_source_crawler.py` | ~400 | Crawler GitHub/Crypto/Weather/HN |
| `scripts/11_ecommerce_streaming.py` | ~360 | Spark Streaming xử lý |
| `docs/10-real-crawler-guide.md` | File này | Tài liệu hướng dẫn |

### Quick start

```bash
# 1. Khởi động infrastructure (đã có sẵn)
docker-compose -f docker-compose.yml -f docker-compose-kafka.yml up -d

# 2. Crawl (terminal 1)
python scripts/09_tiki_crawler.py --category smartphone --max-pages 3

# 3. Spark Streaming (terminal 2)
docker exec lake-spark-master spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
  /scripts/11_ecommerce_streaming.py

# 4. Query (terminal 3)
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
