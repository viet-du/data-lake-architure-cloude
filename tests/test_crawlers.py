import pytest
import responses
from lakehouse.sources.crawlers.base import BaseCrawler

class _TestCrawler(BaseCrawler):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.crawled = []

    @property
    def source_name(self) -> str:
        return 'test'

    def crawl(self):
        response = self._get_json('https://api.example.com/data')
        if response:
            self.crawled.append(response)
        return self.crawled

class TestBaseCrawler:

    def test_crawler_initialization(self) -> None:
        crawler = _TestCrawler(kafka_bootstrap='localhost:9092', rate_limit=0.1)
        assert crawler.source_name == 'test'
        assert crawler.kafka_bootstrap == 'localhost:9092'
        assert crawler.rate_limit == 0.1

    def test_crawler_context_manager(self) -> None:
        with _TestCrawler(rate_limit=0) as crawler:
            assert crawler.session is not None

    @responses.activate
    def test_crawl_success(self) -> None:
        responses.add(responses.GET, 'https://api.example.com/data', json={'key': 'value'}, status=200)
        crawler = _TestCrawler(rate_limit=0)
        result = crawler.crawl()
        assert result == [{'key': 'value'}]

    @responses.activate
    def test_crawl_error(self) -> None:
        responses.add(responses.GET, 'https://api.example.com/data', status=500)
        crawler = _TestCrawler(rate_limit=0)
        result = crawler.crawl()
        assert result == []