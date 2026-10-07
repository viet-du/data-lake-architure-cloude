from __future__ import annotations
import json
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any
import requests
from kafka import KafkaProducer
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from lakehouse.core.constants import DEFAULT_KAFKA_BOOTSTRAP
from lakehouse.core.env import get_env
logger = logging.getLogger(__name__)

class BaseCrawler(ABC):

    def __init__(self, *, kafka_bootstrap: str | None=None, rate_limit: float | None=None, timeout: int=30, max_retries: int=3) -> None:
        self.kafka_bootstrap = kafka_bootstrap or get_env('KAFKA_BOOTSTRAP', DEFAULT_KAFKA_BOOTSTRAP)
        self.rate_limit = rate_limit or float(get_env('CRAWLER_RATE_LIMIT', '1.0'))
        self.timeout = timeout or int(get_env('CRAWLER_TIMEOUT', '30'))
        self.max_retries = max_retries
        self.session = self._build_session()
        self.producer = self._build_producer() if self.kafka_topic else None
        self.stats = {'success': 0, 'failed': 0, 'skipped': 0}

    @property
    @abstractmethod
    def source_name(self) -> str:
        ...

    @property
    def kafka_topic(self) -> str | None:
        return None

    @abstractmethod
    def crawl(self, *args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        ...

    def process(self, raw: dict[str, Any]) -> dict[str, Any]:
        raw['_source'] = self.source_name
        raw['_crawl_timestamp'] = datetime.utcnow().isoformat()
        raw['_event_type'] = 'crawl'
        return raw

    def send_to_kafka(self, items: list[dict[str, Any]]) -> None:
        if not self.producer:
            logger.warning('No Kafka producer configured')
            return
        for item in items:
            try:
                self.producer.send(self.kafka_topic, key=str(item.get('id', '')).encode('utf-8'), value=json.dumps(item, default=str).encode('utf-8'))
                self.stats['success'] += 1
            except Exception as e:
                logger.exception('Failed to send to Kafka: %s', e)
                self.stats['failed'] += 1
        self.producer.flush()
        logger.info(' Sent %s items to topic %s (failed: %d)', self.stats['success'], self.kafka_topic, self.stats['failed'])

    def close(self) -> None:
        if self.producer:
            self.producer.close()
        self.session.close()

    def __enter__(self) -> 'BaseCrawler':
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(total=self.max_retries, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=['GET', 'POST'])
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        session.headers.update({'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
        return session

    def _build_producer(self) -> KafkaProducer | None:
        if not self.kafka_topic:
            return None
        return KafkaProducer(bootstrap_servers=self.kafka_bootstrap.split(','), value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'), key_serializer=lambda k: k.encode('utf-8') if k else None, acks='all', retries=3, linger_ms=10)

    def _request(self, url: str, *, method: str='GET', **kwargs: Any) -> requests.Response | None:
        try:
            time.sleep(self.rate_limit)
            response = self.session.request(method, url, timeout=self.timeout, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logger.warning('Request error for %s: %s', url, e)
            return None

    def _get_json(self, url: str, **kwargs: Any) -> dict[str, Any] | None:
        response = self._request(url, **kwargs)
        return response.json() if response else None