from __future__ import annotations
import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler
logger = logging.getLogger(__name__)

class TikiCrawler(BaseCrawler):
    API_BASE = 'https://tiki.vn/api/v2'
    PRODUCTS_ENDPOINT = '/products'
    REVIEWS_ENDPOINT = '/reviews'
    CATEGORIES = ['smartphone', 'laptop', 'tablet', 'fashion', 'beauty', 'home-appliance']

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._topic_products = KafkaTopics.ECOMMERCE_PRODUCTS
        self._topic_reviews = KafkaTopics.ECOMMERCE_REVIEWS

    @property
    def source_name(self) -> str:
        return 'tiki'

    @property
    def kafka_topic(self) -> str:
        return self._topic_products

    def crawl(self, *, category: str='smartphone', max_pages: int=5, workers: int=4) -> list[dict[str, Any]]:
        logger.info(' Crawling Tiki: category=%s, max_pages=%d', category, max_pages)
        all_products: list[dict[str, Any]] = []
        tasks = [(category, page) for page in range(1, max_pages + 1)]
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(self._crawl_products_page, cat, page): page for (cat, page) in tasks}
            for future in as_completed(futures):
                products = future.result() or []
                all_products.extend(products)
                self.stats['success'] += len(products)
        logger.info(' Crawled %d products', len(all_products))
        return all_products

    def _crawl_products_page(self, category: str, page: int) -> list[dict[str, Any]]:
        url = f'{self.API_BASE}{self.PRODUCTS_ENDPOINT}?category={category}&page={page}&limit=40'
        data = self._get_json(url)
        if not data or 'data' not in data:
            return []
        products = []
        for item in data['data']:
            processed = self.process(item)
            processed['search_keyword'] = category
            products.append(processed)
        return products

    def crawl_reviews(self, product_id: int, max_pages: int=3) -> list[dict[str, Any]]:
        logger.info(' Crawling reviews for product %s', product_id)
        all_reviews: list[dict[str, Any]] = []
        for page in range(1, max_pages + 1):
            url = f'{self.API_BASE}{self.REVIEWS_ENDPOINT}?product_id={product_id}&page={page}'
            data = self._get_json(url)
            if not data or 'data' not in data:
                break
            for review in data['data']:
                review['product_id'] = product_id
                processed = self.process(review)
                processed['_event_type'] = 'review'
                all_reviews.append(processed)
        logger.info(' Crawled %d reviews', len(all_reviews))
        return all_reviews

def main() -> None:
    parser = argparse.ArgumentParser(description='Tiki.vn Crawler')
    parser.add_argument('--category', default='smartphone', help='Category')
    parser.add_argument('--max-pages', type=int, default=5, help='Max pages')
    parser.add_argument('--workers', type=int, default=4, help='Threads')
    parser.add_argument('--mode', default='products', choices=['products', 'reviews', 'flashsale'])
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with TikiCrawler() as crawler:
        products = crawler.crawl(category=args.category, max_pages=args.max_pages, workers=args.workers)
        crawler.send_to_kafka(products)
        crawler.close()
if __name__ == '__main__':
    main()