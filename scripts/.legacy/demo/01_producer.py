import json
import random
import time
from datetime import datetime
from kafka import KafkaProducer
KAFKA_BROKER = 'localhost:9092'
TOPIC = 'clickstream-events'
EVENTS_PER_SECOND = 5
TOTAL_EVENTS = 1000
PAGES = ['home', 'products', 'product_detail', 'cart', 'checkout', 'payment_success']
CATEGORIES = ['electronics', 'books', 'fashion', 'home', 'sports']
EVENTS = ['page_view', 'click', 'add_to_cart', 'purchase', 'search']
print(f' Connecting to Redpanda at {KAFKA_BROKER}...')
producer = KafkaProducer(bootstrap_servers=[KAFKA_BROKER], value_serializer=lambda x: json.dumps(x).encode('utf-8'), key_serializer=lambda x: x.encode('utf-8') if x else None, acks='all', retries=3)
print(f' Connected!')
print(f' Sending to topic: {TOPIC}')
print(f' Rate: {EVENTS_PER_SECOND} events/second')
print(f" Total: {TOTAL_EVENTS or 'infinite'} events")
print()
sent_count = 0
try:
    while TOTAL_EVENTS is None or sent_count < TOTAL_EVENTS:
        event_type = random.choice(EVENTS)
        page = random.choice(PAGES)
        category = random.choice(CATEGORIES)
        event = {'event_id': f'evt_{int(time.time() * 1000)}_{sent_count}', 'user_id': f'user_{random.randint(1, 200):05d}', 'session_id': f'sess_{random.randint(1, 50):05d}', 'event_type': event_type, 'page': page, 'category': category, 'product_id': f'prod_{random.randint(1, 100):04d}', 'amount': round(random.uniform(10, 1000), 2) if event_type == 'purchase' else None, 'timestamp': datetime.now().isoformat(), 'ip_address': f'{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}', 'user_agent': random.choice(['Mozilla/5.0 (Macintosh)', 'Mozilla/5.0 (Windows)', 'Mozilla/5.0 (iPhone)', 'Mozilla/5.0 (Android)'])}
        future = producer.send(TOPIC, key=event['user_id'], value=event)
        sent_count += 1
        if sent_count % 10 == 0:
            print(f' Sent {sent_count} events | Type: {event_type:15s} | Page: {page}')
        time.sleep(1.0 / EVENTS_PER_SECOND)
except KeyboardInterrupt:
    print(f'\n⏹  Stopped by user')
finally:
    producer.flush()
    producer.close()
    print(f"\n Done! Sent {sent_count} events to '{TOPIC}'")
    print(f' Check Redpanda Console: http://localhost:8081')