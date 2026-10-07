import argparse
import gzip
import json
import os
import random
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from queue import Queue
from threading import Thread, Lock, Event
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
OUTPUT_DIR = Path(__file__).parent.parent / 'data-samples'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
KAFKA_BOOTSTRAP = os.getenv('KAFKA_BOOTSTRAP', 'localhost:9092')
KAFKA_TOPIC = 'tiki-category-stream'
CATEGORIES = {'smartphone': {'id': 1789, 'name': 'Điện thoại Smartphone', 'parent': 'electronics'}, 'laptop': {'id': 1846, 'name': 'Laptop', 'parent': 'electronics'}, 'tablet': {'id': 1795, 'name': 'Máy tính bảng', 'parent': 'electronics'}, 'tai-nghe': {'id': 5503, 'name': 'Tai nghe', 'parent': 'electronics'}, 'dong-ho-thong-minh': {'id': 5164, 'name': 'Đồng hồ thông minh', 'parent': 'electronics'}, 'tivi': {'id': 1882, 'name': 'Tivi', 'parent': 'electronics'}, 'may-anh': {'id': 1819, 'name': 'Máy ảnh', 'parent': 'electronics'}, 'phu-kien-dien-tu': {'id': 13656, 'name': 'Phụ kiện điện tử', 'parent': 'electronics'}, 'thoi-trang-nu': {'id': 931, 'name': 'Thời trang nữ', 'parent': 'fashion'}, 'thoi-trang-nam': {'id': 915, 'name': 'Thời trang nam', 'parent': 'fashion'}, 'giay-dep-nu': {'id': 1703, 'name': 'Giày dép nữ', 'parent': 'fashion'}, 'giay-dep-nam': {'id': 1686, 'name': 'Giày dép nam', 'parent': 'fashion'}, 'tui-xach-nu': {'id': 976, 'name': 'Túi xách nữ', 'parent': 'fashion'}, 'phu-kien-thoi-trang': {'id': 27425, 'name': 'Phụ kiện thời trang', 'parent': 'fashion'}, 'my-pham': {'id': 1526, 'name': 'Mỹ phẩm', 'parent': 'beauty'}, 'cham-soc-da': {'id': 1532, 'name': 'Chăm sóc da', 'parent': 'beauty'}, 'trang-diem': {'id': 1534, 'name': 'Trang điểm', 'parent': 'beauty'}, 'nuoc-hoa': {'id': 1551, 'name': 'Nước hoa', 'parent': 'beauty'}, 'do-gia-dung': {'id': 1883, 'name': 'Đồ gia dụng', 'parent': 'home'}, 'noi-that': {'id': 1984, 'name': 'Nội thất', 'parent': 'home'}, 'trang-tri-nha': {'id': 1975, 'name': 'Trang trí nhà cửa', 'parent': 'home'}, 'sach-tieng-viet': {'id': 8322, 'name': 'Sách tiếng Việt', 'parent': 'books'}, 'sach-ngoai-van': {'id': 8323, 'name': 'Sách ngoại văn', 'parent': 'books'}, 'sach-thieu-nhi': {'id': 8551, 'name': 'Sách thiếu nhi', 'parent': 'books'}, 'the-thao': {'id': 1977, 'name': 'Thể thao', 'parent': 'sports'}, 'dien-gia-dung': {'id': 1985, 'name': 'Điện gia dụng', 'parent': 'home'}, 'me-be': {'id': 2523, 'name': 'Mẹ & Bé', 'parent': 'mom-baby'}, 'do-choi': {'id': 2549, 'name': 'Đồ chơi', 'parent': 'mom-baby'}}
session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
adapter = HTTPAdapter(max_retries=retries, pool_maxsize=20)
session.mount('https://', adapter)
session.mount('http://', adapter)
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7', 'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive', 'Referer': 'https://tiki.vn/', 'Origin': 'https://tiki.vn', 'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin'}
session.headers.update(HEADERS)

class ThreadSafeKafkaProducer:

    def __init__(self, bootstrap_servers: list, topic: str):
        from kafka import KafkaProducer
        self.topic = topic
        self.count = 0
        self.lock = Lock()
        self.producer = KafkaProducer(bootstrap_servers=bootstrap_servers, value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode('utf-8'), key_serializer=lambda k: k.encode('utf-8') if k else None, acks='all', retries=3, compression_type='gzip', max_in_flight_requests_per_connection=5, linger_ms=10)
        print(f' Kafka Producer connected: {bootstrap_servers}, topic={topic}')

    def send(self, key: str, value: dict):
        with self.lock:
            self.count += 1
            count = self.count
        future = self.producer.send(self.topic, key=key, value=value)
        return count

    def flush(self):
        self.producer.flush()

    def close(self):
        self.flush()
        self.producer.close()

class CategoryCrawler:

    def __init__(self, category_key: str, category_info: dict, max_pages: int, producer: ThreadSafeKafkaProducer, stats: dict, file_handle):
        self.category_key = category_key
        self.category_info = category_info
        self.max_pages = max_pages
        self.producer = producer
        self.stats = stats
        self.file_handle = file_handle
        self.products_crawled = 0
        self.errors = 0

    def crawl(self):
        cat_id = self.category_info['id']
        cat_name = self.category_info['name']
        parent = self.category_info['parent']
        print(f'   [{self.category_key}] Start: {cat_name}')
        for page in range(1, self.max_pages + 1):
            url = 'https://tiki.vn/api/v2/products'
            params = {'category': cat_id, 'page': page, 'limit': 40, 'sort': 'popular'}
            try:
                response = session.get(url, params=params, timeout=15)
                if response.status_code == 403:
                    print(f'    [{self.category_key}] Rate limited, sleeping 30s...')
                    time.sleep(30)
                    continue
                response.raise_for_status()
                data = response.json()
                products = data.get('data', [])
                if not products:
                    break
                for product in products:
                    event = self.enrich_product(product)
                    self.send_to_kafka(event)
                    self.products_crawled += 1
                if page % 2 == 0:
                    print(f'   [{self.category_key}] Page {page}: {len(products)} products (total: {self.products_crawled})')
                time.sleep(random.uniform(0.5, 1.0))
            except Exception as e:
                self.errors += 1
                if self.errors > 3:
                    print(f'   [{self.category_key}] Too many errors, stopping')
                    break
                time.sleep(2)
        with self.stats['lock']:
            self.stats['total_products'] += self.products_crawled
            self.stats['by_category'][self.category_key] = self.products_crawled
            self.stats['by_parent'][parent] = self.stats['by_parent'].get(parent, 0) + self.products_crawled
        print(f'   [{self.category_key}] Done: {self.products_crawled} products, {self.errors} errors')
        return self.products_crawled

    def enrich_product(self, product: dict) -> dict:
        return {'id': product.get('id'), 'name': product.get('name'), 'sku': product.get('sku'), 'url_key': product.get('url_key'), 'price': product.get('price', 0), 'original_price': product.get('original_price', 0), 'discount': product.get('discount', 0), 'discount_rate': product.get('discount_rate', 0), 'rating_average': product.get('rating_average', 0), 'review_count': product.get('review_count', 0), 'order_count': product.get('quantity_sold', {}).get('value', 0), 'favourite_count': product.get('favourite_count', 0), 'category_key': self.category_key, 'category_name': self.category_name, 'category_id': self.category_id, 'parent_category': self.parent_category, 'brand_name': product.get('brand_name'), 'seller_id': product.get('current_seller', {}).get('id'), 'seller_name': product.get('current_seller', {}).get('name'), 'seller_product_id': product.get('current_seller', {}).get('product_id'), 'thumbnail_url': product.get('thumbnail_url'), 'is_authentic': product.get('authentic', False), 'is_visible': product.get('visible', True), '_crawl_id': str(uuid.uuid4()), '_crawl_timestamp': datetime.utcnow().isoformat() + 'Z', '_crawl_date': datetime.utcnow().strftime('%Y-%m-%d'), '_source': 'tiki.vn', '_thread': threading.current_thread().name}

    def send_to_kafka(self, event: dict):
        try:
            key = f"{self.category_key}:{event.get('id', 'unknown')}"
            self.producer.send(key=key, value=event)
        except Exception as e:
            pass
        try:
            with self.stats['file_lock']:
                self.file_handle.write(json.dumps(event, ensure_ascii=False) + '\n')
        except Exception:
            pass

def run_multithread_crawl(categories: dict, max_pages: int, num_workers: int, output_file: str):
    print(' Connecting to Kafka...')
    producer = ThreadSafeKafkaProducer(bootstrap_servers=[KAFKA_BOOTSTRAP], topic=KAFKA_TOPIC)
    file_handle = open(output_file, 'a', encoding='utf-8')
    stats = {'total_products': 0, 'by_category': {}, 'by_parent': {}, 'lock': Lock(), 'file_lock': Lock()}
    print(f'\n Starting {num_workers} threads for {len(categories)} categories...')
    start_time = time.time()
    workers = []
    for (cat_key, cat_info) in categories.items():
        worker = CategoryCrawler(category_key=cat_key, category_info=cat_info, max_pages=max_pages, producer=producer, stats=stats, file_handle=file_handle)
        workers.append(worker)
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(worker.crawl): worker for worker in workers}
        for future in as_completed(futures):
            worker = futures[future]
            try:
                future.result()
            except Exception as e:
                print(f'   Worker {worker.category_key} error: {e}')
    elapsed = time.time() - start_time
    file_handle.close()
    producer.flush()
    producer.close()
    print(f"\n{'=' * 60}")
    print(f' CRAWL COMPLETED in {elapsed:.1f}s')
    print(f"   Total products: {stats['total_products']:,}")
    print(f"   Categories: {len(stats['by_category'])}")
    print(f"   Parent categories: {len(stats['by_parent'])}")
    print(f"   Throughput: {stats['total_products'] / elapsed:.1f} products/sec")
    print(f"{'=' * 60}")
    print(f'\n TOP 10 categories theo số lượng:')
    for (cat, count) in sorted(stats['by_category'].items(), key=lambda x: -x[1])[:10]:
        print(f'   {cat:30s}: {count:5d} products')
    print(f'\n Doanh số (tổng products) theo parent category:')
    for (parent, count) in sorted(stats['by_parent'].items(), key=lambda x: -x[1]):
        print(f'   {parent:20s}: {count:5d} products')
    return stats

def main():
    parser = argparse.ArgumentParser(description='Multi-thread Tiki Crawler cho phân tích doanh số')
    parser.add_argument('--workers', type=int, default=8, help='Số threads')
    parser.add_argument('--pages', type=int, default=3, help='Số pages mỗi category')
    parser.add_argument('--categories', type=str, default='all', help="Categories: 'all' hoặc comma-separated list")
    parser.add_argument('--groups', type=str, default='', help="Chỉ crawl các parent group (vd: 'electronics,fashion')")
    args = parser.parse_args()
    if args.categories == 'all':
        cats = CATEGORIES
    else:
        cat_keys = [c.strip() for c in args.categories.split(',')]
        cats = {k: v for (k, v) in CATEGORIES.items() if k in cat_keys}
    if args.groups:
        groups = [g.strip() for g in args.groups.split(',')]
        cats = {k: v for (k, v) in cats.items() if v['parent'] in groups}
    print('=' * 60)
    print(f'  Multi-thread Tiki Category Crawler')
    print(f'   Workers: {args.workers}')
    print(f'   Pages/category: {args.pages}')
    print(f'   Categories: {len(cats)}')
    print(f'   Kafka: {KAFKA_BOOTSTRAP}')
    print(f'   Topic: {KAFKA_TOPIC}')
    print('=' * 60)
    output_file = OUTPUT_DIR / f'tiki_crawl_{datetime.now():%Y%m%d_%H%M%S}.jsonl'
    import threading
    run_multithread_crawl(cats, args.pages, args.workers, str(output_file))
if __name__ == '__main__':
    import threading
    main()