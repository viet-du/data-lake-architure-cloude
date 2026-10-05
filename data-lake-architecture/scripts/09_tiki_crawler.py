"""
Crawler thật từ Tiki.vn (không cần API key, dùng public API)
Gửi data vào Kafka topic `ecommerce-products-stream`

Data flow:
  Tiki API → Crawler → Kafka → Spark Streaming → Delta Lake Bronze → Silver → Gold

Tính năng:
  - Crawl products theo category (smartphone, laptop, fashion...)
  - Crawl theo keyword (search)
  - Crawl product details (giá, rating, reviews)
  - Crawl flash sale (realtime)
  - Crawl reviews

Chạy:
  python scripts/09_tiki_crawler.py --category smartphone --max-pages 5
  python scripts/09_tiki_crawler.py --keyword "iphone 15"
  python scripts/09_tiki_crawler.py --mode flashsale
  python scripts/09_tiki_crawler.py --mode reviews --product-id 123456
"""
import argparse
import gzip
import json
import os
import random
import time
from datetime import datetime
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============ Configuration ============
OUTPUT_DIR = Path(__file__).parent.parent / "data-samples"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Kafka
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
KAFKA_TOPIC_PRODUCTS = "ecommerce-products-stream"
KAFKA_TOPIC_REVIEWS = "ecommerce-reviews-stream"
KAFKA_TOPIC_PRICES = "ecommerce-price-stream"

# Local backup
KAFKA_ENABLED = os.getenv("KAFKA_ENABLED", "true").lower() == "true"

# Tiki API (public, không cần auth)
TIKI_BASE_URL = "https://tiki.vn/api/v2"
TIKI_SEARCH_URL = f"{TIKI_BASE_URL}/products"

# Cấu hình retry
session = requests.Session()
retries = Retry(
    total=3, backoff_factor=0.5,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Headers giả lập browser thật
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://tiki.vn/",
    "Origin": "https://tiki.vn",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

# Categories Tiki (lấy từ trang chủ)
CATEGORIES = {
    "smartphone": {"id": 1789, "name": "Điện thoại Smartphone"},
    "laptop": {"id": 1846, "name": "Laptop"},
    "tablet": {"id": 1795, "name": "Máy tính bảng"},
    "tai-nghe": {"id": 5503, "name": "Tai nghe"},
    "dong-ho": {"id": 5164, "name": "Đồng hồ thông minh"},
    "fashion-nu": {"id": 931, "name": "Thời trang nữ"},
    "fashion-nam": {"id": 915, "name": "Thời trang nam"},
    "my-pham": {"id": 1526, "name": "Mỹ phẩm"},
    "sach": {"id": 8322, "name": "Sách"},
    "gia-dung": {"id": 1883, "name": "Đồ gia dụng"},
}

# ============ Tiki Crawler ============
class TikiCrawler:
    """Crawler chính cho Tiki.vn."""

    def __init__(self, use_kafka: bool = KAFKA_ENABLED):
        self.session = session
        self.session.headers.update(HEADERS)
        self.use_kafka = use_kafka

        # Kafka producer
        self.kafka_producer = None
        if self.use_kafka:
            try:
                from kafka import KafkaProducer
                self.kafka_producer = KafkaProducer(
                    bootstrap_servers=[KAFKA_BOOTSTRAP],
                    value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
                    key_serializer=lambda k: k.encode("utf-8") if k else None,
                    acks="all",
                    retries=3,
                    compression_type="gzip",
                )
                print("✅ Connected to Kafka")
            except Exception as e:
                print(f"⚠️  Kafka not available: {e}. Falling back to file-only mode.")
                self.use_kafka = False

        # File backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.file_handle = gzip.open(
            OUTPUT_DIR / f"tiki_crawl_{timestamp}.jsonl.gz",
            "at", encoding="utf-8"
        )

    def close(self):
        """Cleanup."""
        if self.kafka_producer:
            self.kafka_producer.flush()
            self.kafka_producer.close()
        if self.file_handle:
            self.file_handle.close()

    def send_event(self, event: dict, topic: str):
        """Gửi event vào Kafka + lưu file backup."""
        # Add crawl metadata
        event["_crawl_timestamp"] = datetime.utcnow().isoformat() + "Z"
        event["_source"] = "tiki.vn"
        event["_kafka_topic"] = topic

        # Send to Kafka
        if self.kafka_producer:
            try:
                key = str(event.get("product_id", event.get("id", "unknown")))
                self.kafka_producer.send(topic, key=key, value=event)
            except Exception as e:
                print(f"  ⚠️  Kafka send failed: {e}")

        # Write to file backup
        self.file_handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        self.file_handle.flush()

    def crawl_category(self, category_key: str, max_pages: int = 5, delay: float = 1.0):
        """
        Crawl products theo category.
        Mỗi page có ~40 products.
        """
        if category_key not in CATEGORIES:
            print(f"❌ Unknown category: {category_key}")
            print(f"Available: {list(CATEGORIES.keys())}")
            return

        category = CATEGORIES[category_key]
        print(f"\n{'='*60}")
        print(f"📦 Crawling category: {category['name']} (ID: {category['id']})")
        print(f"   Max pages: {max_pages}, Delay: {delay}s")
        print(f"{'='*60}")

        total_products = 0

        for page in range(1, max_pages + 1):
            url = f"{TIKI_SEARCH_URL}"
            params = {
                "category": category["id"],
                "page": page,
                "limit": 40,  # Max per page
                "sort": "popular",
            }

            try:
                response = self.session.get(url, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()

                products = data.get("data", [])
                if not products:
                    print(f"  ⚠️  Page {page}: No products, stopping")
                    break

                print(f"  ✅ Page {page}: {len(products)} products")

                for product in products:
                    # Enrich
                    product["category_key"] = category_key
                    product["category_name"] = category["name"]
                    product["category_id"] = category["id"]
                    product["_event_type"] = "product_view"

                    self.send_event(product, KAFKA_TOPIC_PRODUCTS)
                    total_products += 1

                # Rate limit
                time.sleep(delay + random.uniform(0, 0.5))

            except requests.exceptions.RequestException as e:
                print(f"  ❌ Page {page} error: {e}")
                continue
            except json.JSONDecodeError as e:
                print(f"  ❌ Page {page} JSON error: {e}")
                continue

        print(f"\n✅ Total: {total_products} products crawled")
        return total_products

    def crawl_search(self, keyword: str, max_pages: int = 3, delay: float = 1.0):
        """
        Crawl products theo keyword search.
        """
        print(f"\n{'='*60}")
        print(f"🔍 Searching: '{keyword}'")
        print(f"{'='*60}")

        total = 0

        for page in range(1, max_pages + 1):
            params = {
                "q": keyword,
                "page": page,
                "limit": 40,
                "sort": "relevance",
            }

            try:
                response = self.session.get(TIKI_SEARCH_URL, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()

                products = data.get("data", [])
                if not products:
                    break

                print(f"  ✅ Page {page}: {len(products)} results")

                for product in products:
                    product["search_keyword"] = keyword
                    product["_event_type"] = "search_result"
                    self.send_event(product, KAFKA_TOPIC_PRODUCTS)
                    total += 1

                time.sleep(delay + random.uniform(0, 0.5))

            except Exception as e:
                print(f"  ❌ Error: {e}")
                continue

        print(f"\n✅ Total: {total} products")
        return total

    def crawl_product_detail(self, product_id: str):
        """
        Crawl chi tiết 1 product (price, stock, description, seller...).
        """
        url = f"{TIKI_BASE_URL}/products/{product_id}"

        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            product = response.json()

            if product:
                product["_event_type"] = "product_detail"
                self.send_event(product, KAFKA_TOPIC_PRODUCTS)
                return product

        except Exception as e:
            print(f"  ❌ Error crawling product {product_id}: {e}")
            return None

    def crawl_flashsale(self, max_pages: int = 3, delay: float = 2.0):
        """
        Crawl flash sale products (realtime deals).
        """
        print(f"\n{'='*60}")
        print(f"⚡ Crawling Flash Sale")
        print(f"{'='*60}")

        url = f"{TIKI_BASE_URL}/flashsale"
        total = 0

        for page in range(1, max_pages + 1):
            params = {"page": page, "limit": 50}

            try:
                response = self.session.get(url, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()

                # Flash sale structure khác
                flash_sales = data.get("data", {}).get("items", [])

                if not flash_sales:
                    # Try alternative endpoint
                    break

                print(f"  ✅ Page {page}: {len(flash_sales)} flash sale items")

                for item in flash_sales:
                    item["_event_type"] = "flashsale"
                    self.send_event(item, KAFKA_TOPIC_PRICES)
                    total += 1

                time.sleep(delay)

            except Exception as e:
                print(f"  ⚠️  Flash sale endpoint may have changed: {e}")
                break

        print(f"\n✅ Total: {total} flash sale items")
        return total

    def crawl_reviews(self, product_id: str, max_pages: int = 3, delay: float = 1.0):
        """
        Crawl reviews của 1 product.
        """
        print(f"\n{'='*60}")
        print(f"💬 Crawling reviews for product: {product_id}")
        print(f"{'='*60}")

        url = f"{TIKI_BASE_URL}/reviews"
        total = 0

        for page in range(1, max_pages + 1):
            params = {
                "product_id": product_id,
                "page": page,
                "limit": 20,
                "sort": "score",
            }

            try:
                response = self.session.get(url, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()

                reviews = data.get("data", [])
                if not reviews:
                    break

                print(f"  ✅ Page {page}: {len(reviews)} reviews")

                for review in reviews:
                    review["product_id"] = product_id
                    review["_event_type"] = "review"
                    self.send_event(review, KAFKA_TOPIC_REVIEWS)
                    total += 1

                time.sleep(delay)

            except Exception as e:
                print(f"  ❌ Error: {e}")
                break

        print(f"\n✅ Total: {total} reviews")
        return total

    def monitor_price_changes(self, product_ids: list, interval: int = 60, duration: int = 600):
        """
        Monitor giá của N products, mỗi `interval` giây, trong `duration` giây.
        Dùng để track price changes (real-time price tracking).
        """
        print(f"\n{'='*60}")
        print(f"💰 Monitoring price for {len(product_ids)} products")
        print(f"   Interval: {interval}s, Duration: {duration}s")
        print(f"{'='*60}")

        start = time.time()
        iterations = 0

        while time.time() - start < duration:
            iterations += 1
            print(f"\n  📊 Iteration {iterations} ({datetime.now().strftime('%H:%M:%S')})")

            for pid in product_ids:
                product = self.crawl_product_detail(pid)
                if product:
                    # Extract price info
                    price_event = {
                        "product_id": product.get("id"),
                        "product_name": product.get("name"),
                        "price": product.get("price"),
                        "original_price": product.get("original_price"),
                        "discount": product.get("discount"),
                        "discount_rate": product.get("discount_rate"),
                        "stock_quantity": product.get("stock_item", {}).get("qty"),
                        "seller_id": product.get("current_seller", {}).get("id"),
                        "seller_name": product.get("current_seller", {}).get("name"),
                        "_event_type": "price_update",
                        "_iteration": iterations,
                    }
                    self.send_event(price_event, KAFKA_TOPIC_PRICES)

                time.sleep(0.5)  # Delay giữa các products

            # Chờ interval
            elapsed = time.time() - start
            if elapsed + interval < duration:
                print(f"  ⏸️  Waiting {interval}s...")
                time.sleep(interval)

        print(f"\n✅ Monitored for {iterations} iterations over {duration}s")


# ============ Main ============
def main():
    parser = argparse.ArgumentParser(description="Tiki.vn Crawler - Gửi data vào Kafka")
    parser.add_argument("--mode", choices=["category", "search", "detail", "flashsale", "reviews", "monitor"],
                        default="category", help="Chế độ crawl")
    parser.add_argument("--category", type=str, default="smartphone",
                        help="Category key (smartphone, laptop, fashion-nu...)")
    parser.add_argument("--keyword", type=str, help="Search keyword")
    parser.add_argument("--product-id", type=str, help="Product ID (cho detail/reviews/monitor)")
    parser.add_argument("--max-pages", type=int, default=3, help="Số pages tối đa")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay giữa các request (giây)")
    parser.add_argument("--interval", type=int, default=60, help="Interval cho monitor mode")
    parser.add_argument("--duration", type=int, default=600, help="Duration cho monitor mode")
    parser.add_argument("--no-kafka", action="store_true", help="Không gửi Kafka, chỉ lưu file")

    args = parser.parse_args()

    print("=" * 60)
    print("🛒 Tiki.vn Crawler")
    print(f"   Mode: {args.mode}")
    if args.mode == "category":
        print(f"   Category: {args.category}")
    elif args.mode == "search":
        print(f"   Keyword: {args.keyword}")
    elif args.mode == "detail" or args.mode == "reviews":
        print(f"   Product ID: {args.product_id}")
    print("=" * 60)

    crawler = TikiCrawler(use_kafka=not args.no_kafka)

    try:
        if args.mode == "category":
            crawler.crawl_category(args.category, args.max_pages, args.delay)

        elif args.mode == "search":
            if not args.keyword:
                print("❌ --keyword required for search mode")
                return
            crawler.crawl_search(args.keyword, args.max_pages, args.delay)

        elif args.mode == "detail":
            if not args.product_id:
                print("❌ --product-id required for detail mode")
                return
            crawler.crawl_product_detail(args.product_id)

        elif args.mode == "flashsale":
            crawler.crawl_flashsale(args.max_pages, args.delay)

        elif args.mode == "reviews":
            if not args.product_id:
                print("❌ --product-id required for reviews mode")
                return
            crawler.crawl_reviews(args.product_id, args.max_pages, args.delay)

        elif args.mode == "monitor":
            if not args.product_id:
                # Default: monitor 5 sản phẩm hot
                product_ids = [
                    "195612559",  # iPhone 15 Pro
                    "196001148",  # Samsung Galaxy S24
                    "192026801",  # MacBook Air M2
                ]
            else:
                product_ids = [args.product_id]

            crawler.monitor_price_changes(product_ids, args.interval, args.duration)

    finally:
        crawler.close()
        print("\n✅ Crawler finished. Data saved to data-samples/tiki_crawl_*.jsonl.gz")


if __name__ == "__main__":
    main()
