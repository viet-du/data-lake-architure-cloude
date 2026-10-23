"""Tests for TikiCrawler category_id handling.

Tiki's /api/v2/products requires a numeric `category` query param.
The crawler maps human-readable slugs ("smartphone", "laptop", ...) to
the correct integer IDs.
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest


class TestTikiCategoryMapping:
    def setup_method(self) -> None:
        from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler
        self.TikiCrawler = TikiCrawler

    def test_known_slugs_resolve_to_int(self) -> None:
        ids = self.TikiCrawler.CATEGORY_IDS
        assert ids == {
            "smartphone": 1795,
            "laptop": 1846,
            "tablet": 1789,
            "fashion": 931,
            "beauty": 1520,
            "home-appliance": 1882,
        }

    def test_unknown_slug_raises(self) -> None:
        from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler

        with pytest.raises(ValueError, match="Unknown Tiki category"):
            crawler = TikiCrawler.__new__(TikiCrawler)  # bypass __init__
            # call without calling super().__init__
            crawler.CATEGORY_IDS = {"smartphone": 1789}
            crawler.crawl(category="definitely-not-a-real-slug")

    def test_slug_lookup_roundtrip(self) -> None:
        from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler

        crawler = TikiCrawler.__new__(TikiCrawler)
        assert crawler._slug_for_id(1795) == "smartphone"
        assert crawler._slug_for_id(1846) == "laptop"
        assert crawler._slug_for_id(99999) == "99999"

    def test_product_page_uses_numeric_category_and_accepts_live_shape(self) -> None:
        crawler = self.TikiCrawler.__new__(self.TikiCrawler)
        calls: list[tuple[str, dict[str, str]]] = []

        def fake_get_json(url: str, **kwargs):
            calls.append((url, kwargs["headers"]))
            return {"data": [{"id": 10, "name": "real API shape"}]}

        crawler._get_json = fake_get_json
        products = crawler._crawl_products_page("smartphone", 1795, 1)

        assert len(products) == 1
        assert products[0]["id"] == 10
        assert products[0]["name"] == "real API shape"
        assert parse_qs(urlparse(calls[0][0]).query)["category"] == ["1795"]
        assert calls[0][1]["Accept"] == "application/json, text/plain, */*"

    def test_crawl_keeps_valid_pages_when_one_page_is_blocked(self) -> None:
        crawler = self.TikiCrawler.__new__(self.TikiCrawler)
        crawler.stats = {"success": 0}

        def fake_page(category: str, category_id: int, page: int):
            if page == 2:
                raise RuntimeError("upstream returned HTML")
            return [{"id": page, "category_id": category_id, "category": category}]

        crawler._crawl_products_page = fake_page
        products = crawler.crawl(category="smartphone", max_pages=3, workers=1)

        assert [product["id"] for product in products] == [1, 3]
        assert crawler.stats["success"] == 2

    def test_crawl_fails_if_every_page_is_invalid(self) -> None:
        crawler = self.TikiCrawler.__new__(self.TikiCrawler)
        crawler.stats = {"success": 0}
        crawler._crawl_products_page = lambda *_args: (_ for _ in ()).throw(
            RuntimeError("upstream returned HTML")
        )

        with pytest.raises(RuntimeError, match="no valid pages"):
            crawler.crawl(category="smartphone", max_pages=2, workers=1)
