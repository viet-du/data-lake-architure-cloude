from __future__ import annotations
import argparse
import json
import logging
import random
import signal
import time
import uuid
from datetime import datetime
from kafka import KafkaProducer
from lakehouse.core.constants import DEFAULT_KAFKA_BOOTSTRAP, KafkaTopics
from lakehouse.core.env import get_env
logger = logging.getLogger(__name__)

class ClickstreamProducer:
    PAGES = ['/home', '/products', '/products/iphone-15', '/cart', '/checkout', '/about', '/blog/cloud', '/search?q=kafka']
    EVENT_TYPES_WEIGHTED = [('page_view', 50), ('click', 25), ('scroll', 15), ('add_to_cart', 5), ('purchase', 2), ('search', 3)]

    def __init__(self, *, kafka_bootstrap: str | None=None, topic: str | None=None, rate: float=10.0, num_users: int=1000, num_sessions: int=5000) -> None:
        self.kafka_bootstrap = kafka_bootstrap or get_env('KAFKA_BOOTSTRAP', DEFAULT_KAFKA_BOOTSTRAP)
        self.topic = topic or KafkaTopics.CLICKSTREAM_EVENTS
        self.rate = rate
        self.users = [f'U{str(i).zfill(4)}' for i in range(1, num_users + 1)]
        self.sessions = [f'S{str(i).zfill(6)}' for i in range(1, num_sessions + 1)]
        self._running = False
        self.producer = KafkaProducer(bootstrap_servers=self.kafka_bootstrap.split(','), value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'), key_serializer=lambda k: k.encode('utf-8') if k else None, acks='all', linger_ms=10)

    def generate_event(self) -> dict:
        event_type = random.choices([e[0] for e in self.EVENT_TYPES_WEIGHTED], weights=[e[1] for e in self.EVENT_TYPES_WEIGHTED])[0]
        return {'event_id': str(uuid.uuid4()), 'user_id': random.choice(self.users), 'session_id': random.choice(self.sessions), 'event_type': event_type, 'page_url': random.choice(self.PAGES), 'timestamp': datetime.utcnow().isoformat(), 'metadata': json.dumps({'device': random.choice(['mobile', 'desktop'])})}

    def send_event(self, event: dict) -> None:
        self.producer.send(self.topic, key=event['session_id'], value=event)

    def run(self, *, max_events: int | None=None) -> None:
        self._running = True
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)
        interval = 1.0 / self.rate
        count = 0
        logger.info(' Clickstream producer started: rate=%.1f/s, topic=%s', self.rate, self.topic)
        while self._running:
            try:
                event = self.generate_event()
                self.send_event(event)
                count += 1
                if max_events and count >= max_events:
                    logger.info(' Reached max_events=%d, stopping', max_events)
                    break
                time.sleep(interval)
            except Exception as e:
                logger.exception('Error sending event: %s', e)
        self.producer.flush()
        self.producer.close()
        logger.info('⏹  Producer stopped. Sent %d events', count)

    def _stop(self, *_: object) -> None:
        logger.info('Received stop signal...')
        self._running = False

def main() -> None:
    parser = argparse.ArgumentParser(description='Clickstream Kafka Producer')
    parser.add_argument('--rate', type=float, default=10.0, help='Events per second')
    parser.add_argument('--max-events', type=int, default=None, help='Max events')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(message)s')
    producer = ClickstreamProducer(rate=args.rate)
    producer.run(max_events=args.max_events)
if __name__ == '__main__':
    main()