from __future__ import annotations
import argparse
import logging
import os
from typing import Any
from lakehouse.core.constants import KafkaTopics
from lakehouse.sources.crawlers.base import BaseCrawler
logger = logging.getLogger(__name__)

class WeatherCrawler(BaseCrawler):
    API_BASE = 'https://api.openweathermap.org/data/2.5'
    DEFAULT_CITIES = ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Can Tho', 'Hai Phong']

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.api_key = os.getenv('OPENWEATHER_API_KEY')

    @property
    def source_name(self) -> str:
        return 'openweather'

    @property
    def kafka_topic(self) -> str:
        return KafkaTopics.WEATHER

    def crawl(self, *, cities: list[str] | None=None) -> list[dict[str, Any]]:
        cities = cities or self.DEFAULT_CITIES
        if not self.api_key:
            logger.warning('  OPENWEATHER_API_KEY not set, skipping')
            return []
        logger.info('  Crawling weather for %d cities', len(cities))
        items = []
        for city in cities:
            data = self._crawl_city(city)
            if data:
                items.append(data)
        logger.info(' Crawled weather for %d cities', len(items))
        return items

    def _crawl_city(self, city: str) -> dict[str, Any] | None:
        url = f'{self.API_BASE}/weather?q={city}&appid={self.api_key}&units=metric'
        data = self._get_json(url)
        if not data:
            return None
        return self.process({'city': city, 'temperature_c': data['main']['temp'], 'humidity': data['main']['humidity'], 'pressure': data['main']['pressure'], 'weather': data['weather'][0]['main'], 'wind_speed': data['wind']['speed'], 'country': data['sys']['country']})

def main() -> None:
    parser = argparse.ArgumentParser(description='OpenWeather Crawler')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    with WeatherCrawler() as crawler:
        items = crawler.crawl()
        crawler.send_to_kafka(items)
if __name__ == '__main__':
    main()