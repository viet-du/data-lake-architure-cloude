from __future__ import annotations
import argparse
import logging
from typing import Any
from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler
logger = logging.getLogger(__name__)

class GithubCrawler(BaseCrawler):
    API_BASE = 'https://api.github.com'

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    @property
    def source_name(self) -> str:
        return 'github'

    @property
    def kafka_topic(self) -> str:
        return KafkaTopics.GITHUB_TRENDING

    def crawl(self, *, language: str='python', since: str='daily', max_repos: int=50) -> list[dict[str, Any]]:
        logger.info(' Crawling GitHub trending: language=%s, since=%s', language, since)
        url = f'{self.API_BASE}/search/repositories?q=language:{language}&sort=stars&order=desc&per_page={min(max_repos, 100)}'
        data = self._get_json(url)
        if not data or 'items' not in data:
            return []
        repos = []
        for item in data['items'][:max_repos]:
            processed = self.process({'id': item['id'], 'name': item['full_name'], 'description': item.get('description'), 'language': item.get('language'), 'stars': item['stargazers_count'], 'forks': item['forks_count'], 'url': item['html_url'], 'owner': item['owner']['login'], 'since': since})
            repos.append(processed)
        logger.info(' Crawled %d repos', len(repos))
        return repos

def main() -> None:
    parser = argparse.ArgumentParser(description='GitHub Trending Crawler')
    parser.add_argument('--language', default='python')
    parser.add_argument('--max-repos', type=int, default=50)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with GithubCrawler() as crawler:
        repos = crawler.crawl(language=args.language, max_repos=args.max_repos)
        crawler.send_to_kafka(repos)
if __name__ == '__main__':
    main()