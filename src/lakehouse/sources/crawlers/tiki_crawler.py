from __future__ import annotations

import argparse
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler

logger = logging.getLogger(__name__)


class TikiCrawler(BaseCrawler):
    API_BASE = "https://tiki.vn/api/v2"
    PRODUCTS_ENDPOINT = "/products"
    REVIEWS_ENDPOINT = "/reviews"
    # /api/v2/products expects a numeric category ID, not the human-readable
    # slugs passed by Airflow. IDs are taken from Tiki's public category tree.
    CATEGORY_IDS = {
        "smartphone": 1795,
        "laptop": 1846,
        "tablet": 1789,
        "fashion": 931,
        "beauty": 1520,
        "home-appliance": 1882,
    }
    CATEGORIES = tuple(CATEGORY_IDS)

    def __init__(self, **kwargs: Any) -> None:
        # Assign topic attributes BEFORE super().__init__() because
        # BaseCrawler.__init__ accesses self.kafka_topic during producer setup.
        self._topic_products = KafkaTopics.ECOMMERCE_PRODUCTS
        self._topic_reviews = KafkaTopics.ECOMMERCE_REVIEWS
        super().__init__(**kwargs)

    @property
    def source_name(self) -> str:
        return "tiki"

    @property
    def kafka_topic(self) -> str:
        return self._topic_products

    def _slug_for_id(self, category_id: int) -> str:
        return next(
            (slug for slug, value in self.CATEGORY_IDS.items() if value == category_id),
            str(category_id),
        )

    def crawl(
        self, *, category: str = "smartphone", max_pages: int = 5, workers: int = 4
    ) -> list[dict[str, Any]]:
        logger.info(" Crawling Tiki: category=%s, max_pages=%d", category, max_pages)
        category_id = self.CATEGORY_IDS.get(category)
        if category_id is None:
            raise ValueError(
                f"Unknown Tiki category {category!r}; expected one of {', '.join(self.CATEGORIES)}"
            )
        all_products: list[dict[str, Any]] = []
        failed_pages: list[tuple[int, Exception]] = []
        tasks = [(category, category_id, page) for page in range(1, max_pages + 1)]
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self._crawl_products_page, cat, cat_id, page): page
                for (cat, cat_id, page) in tasks
            }
            for future in as_completed(futures):
                page = futures[future]
                try:
                    products = future.result() or []
                except Exception as exc:  # noqa: BLE001
                    failed_pages.append((page, exc))
                    logger.warning(
                        "Tiki category %s page %d failed: %s", category, page, exc
                    )
                    continue
                all_products.extend(products)
                self.stats["success"] += len(products)
        if failed_pages and all_products:
            failed_numbers = ", ".join(str(page) for page, _ in sorted(failed_pages))
            logger.warning(
                "Tiki category %s returned partial data: %d products; "
                "failed pages: %s",
                category,
                len(all_products),
                failed_numbers,
            )
        elif failed_pages:
            failed_numbers = ", ".join(str(page) for page, _ in sorted(failed_pages))
            raise RuntimeError(
                f"Tiki returned no valid pages for category {category!r}; "
                f"failed pages: {failed_numbers}"
            ) from failed_pages[0][1]
        logger.info(" Crawled %d products", len(all_products))
        return all_products

    def _crawl_products_page(
        self, category: str, category_id: int, page: int
    ) -> list[dict[str, Any]]:
        url = (
            f"{self.API_BASE}{self.PRODUCTS_ENDPOINT}"
            f"?category={category_id}&page={page}&limit=40"
        )
        data = self._get_json(
            url,
            headers={
                "Accept": "application/json, text/plain, */*",
                "Referer": "https://tiki.vn/",
            },
        )
        if data is None:
            raise RuntimeError(
                f"Tiki returned a non-JSON or empty response for category "
                f"{category!r} (category_id={category_id}, page={page})"
            )
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise RuntimeError(
                f"Tiki returned an unexpected product payload for category "
                f"{category!r} (category_id={category_id}, page={page})"
            )
        if not data["data"]:
            return []
        products = []
        for item in data["data"]:
            processed = self.process(item)
            processed["search_keyword"] = category
            products.append(processed)
        return products

    def crawl_reviews(self, product_id: int, max_pages: int = 3) -> list[dict[str, Any]]:
        logger.info(" Crawling reviews for product %s", product_id)
        all_reviews: list[dict[str, Any]] = []
        for page in range(1, max_pages + 1):
            url = f"{self.API_BASE}{self.REVIEWS_ENDPOINT}?product_id={product_id}&page={page}"
            data = self._get_json(url)
            if not data or "data" not in data:
                break
            for review in data["data"]:
                review["product_id"] = product_id
                processed = self.process(review)
                processed["_event_type"] = "review"
                all_reviews.append(processed)
        logger.info(" Crawled %d reviews", len(all_reviews))
        return all_reviews


def main() -> None:
    parser = argparse.ArgumentParser(description="Tiki.vn Crawler")
    parser.add_argument("--category", default="smartphone", help="Category")
    parser.add_argument("--max-pages", type=int, default=5, help="Max pages")
    parser.add_argument("--workers", type=int, default=4, help="Threads")
    parser.add_argument("--mode", default="products", choices=["products", "reviews", "flashsale"])
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with TikiCrawler() as crawler:
        products = crawler.crawl(
            category=args.category, max_pages=args.max_pages, workers=args.workers
        )
        crawler.send_to_kafka(products)
        crawler.close()


if __name__ == "__main__":
    main()
