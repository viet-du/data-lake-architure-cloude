from __future__ import annotations
import argparse
import logging
from typing import Any
from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler
logger = logging.getLogger(__name__)

class HackerNewsCrawler(BaseCrawler):
    API_BASE = 'https://hacker-news.firebaseio.com/v0'

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    @property
    def source_name(self) -> str:
        return 'hackernews'

    @property
    def kafka_topic(self) -> str:
        return KafkaTopics.HACKERNEWS

    def crawl(self, *, max_stories: int=50) -> list[dict[str, Any]]:
        logger.info(' Crawling Hacker News top %d stories', max_stories)
        ids = self._get_json(f'{self.API_BASE}/topstories.json') or []
        ids = ids[:max_stories]
        items = []
        for story_id in ids:
            story = self._crawl_story(story_id)
            if story:
                items.append(story)
        logger.info(' Crawled %d stories', len(items))
        return items

    def _crawl_story(self, story_id: int) -> dict[str, Any] | None:
        data = self._get_json(f'{self.API_BASE}/item/{story_id}.json')
        if not data:
            return None
        return self.process({'id': data['id'], 'title': data.get('title'), 'url': data.get('url'), 'score': data.get('score'), 'by': data.get('by'), 'descendants': data.get('descendants'), 'type': data.get('type'), 'time': data.get('time')})

def main() -> None:
    parser = argparse.ArgumentParser(description='Hacker News Crawler')
    parser.add_argument('--max-stories', type=int, default=50)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with HackerNewsCrawler() as crawler:
        items = crawler.crawl(max_stories=args.max_stories)
        crawler.send_to_kafka(items)
if __name__ == '__main__':
    main()