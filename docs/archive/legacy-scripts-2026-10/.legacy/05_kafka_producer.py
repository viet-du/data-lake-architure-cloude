import json
import random
import time
import uuid
import signal
import sys
from datetime import datetime
from kafka import KafkaProducer
KAFKA_BOOTSTRAP = ['localhost:9092']
TOPIC = 'clickstream-events'
USERS = [f'U{str(i).zfill(4)}' for i in range(1, 1001)]
SESSIONS = [f'S{str(i).zfill(6)}' for i in range(1, 5001)]
PAGES = ['/home', '/products', '/products/iphone-15', '/cart', '/checkout', '/about', '/blog/cloud', '/search?q=kafka']
EVENT_TYPES_WEIGHTED = [('page_view', 50), ('click', 25), ('scroll', 15), ('add_to_cart', 5), ('purchase', 2), ('search', 3)]
CATEGORIES = ['electronics', 'books', 'fashion', 'home', 'sports']

def generate_event() -> dict:
    event_type = random.choices([e[0] for e in EVENT_TYPES_WEIGHTED], weights=[e[1] for e in EVENT_TYPES_WEIGHTED])[0]
    event = {'event_id': str(uuid.uuid4()), 'user_id': random.choice(USERS), 'session_id': random.choice(SESSIONS), 'event_type': event_type, 'page_url': random.choice(PAGES), 'referrer': random.choice(['google.com', 'facebook.com', 'direct']), 'user_agent': 'Mozilla/5.0', 'ip_address': f'{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}', 'timestamp': datetime.utcnow().isoformat() + 'Z', 'metadata': {'category': random.choice(CATEGORIES)}}
    if event_type == 'purchase':
        event['metadata']['amount'] = round(random.uniform(10, 2000), 2)
        event['metadata']['product_id'] = f'P{random.randint(1, 500)}'
    elif event_type == 'search':
        event['metadata']['search_query'] = random.choice(['kafka', 'data', 'laptop'])
    return event

def main():
    print(' Clickstream Producer')
    print(f'   Topic: {TOPIC}, Rate: 10 events/sec')
    producer = KafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP, value_serializer=lambda v: json.dumps(v).encode('utf-8'), key_serializer=lambda k: k.encode('utf-8') if k else None)
    count = 0
    try:
        while True:
            event = generate_event()
            producer.send(TOPIC, key=event['user_id'], value=event)
            count += 1
            if count % 100 == 0:
                print(f' Sent {count} events')
            time.sleep(0.1)
    except KeyboardInterrupt:
        producer.flush()
        producer.close()
        print(f'\n Stopped. Total: {count}')
if __name__ == '__main__':
    main()