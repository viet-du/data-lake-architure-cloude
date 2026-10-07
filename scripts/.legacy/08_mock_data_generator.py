import argparse
import gzip
import json
import random
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
random.seed(42)
OUTPUT_DIR = Path(__file__).parent.parent / 'data-samples'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class MockDataGenerator:

    def __init__(self, dirty_data=True):
        self.dirty_data = dirty_data
        self.customer_cache = []
        self.product_cache = []

    def generate_customer(self, idx):
        cities = [('Ha Noi', 'VN-HN'), ('TP HCM', 'VN-SG'), ('Da Nang', 'VN-DN')]
        segments = ['VIP', 'Gold', 'Silver', 'Bronze']
        segment = random.choices(segments, weights=[0.05, 0.15, 0.3, 0.5])[0]
        customer = {'customer_id': f'C{idx:06d}', 'first_name': random.choice(['Nguyen Van', 'Tran Thi', 'Le Hoang']), 'last_name': random.choice(['An', 'Binh', 'Cuong']), 'email': f'customer{idx}@example.com', 'phone': f'09{random.randint(10000000, 99999999)}', 'city': random.choice([c[0] for c in cities]), 'age': random.randint(18, 70), 'gender': random.choice(['M', 'F']), 'segment': segment, 'lifetime_value': round(random.uniform(100, 50000) if segment == 'VIP' else random.uniform(10, 5000), 2), 'registration_date': (datetime(2023, 1, 1) + timedelta(days=random.randint(0, 700))).strftime('%Y-%m-%d'), 'is_active': random.choices([True, False], weights=[0.8, 0.2])[0]}
        if self.dirty_data and random.random() < 0.05:
            customer['email'] = customer['email'].replace('@', ' at ')
        return customer

    def generate_product(self, idx):
        cats = ['Electronics', 'Books', 'Fashion', 'Home', 'Sports']
        cat = random.choice(cats)
        return {'product_id': f'P{idx:05d}', 'product_name': f'Product {idx}', 'category': cat, 'price': round(random.uniform(10, 3000), 2), 'stock_quantity': random.randint(0, 500), 'rating': round(random.uniform(1.0, 5.0), 1)}

    def generate_clickstream(self):
        return {'event_id': str(uuid.uuid4()), 'user_id': f'U{random.randint(1, 1000):05d}', 'session_id': f'S{random.randint(1, 5000):06d}', 'event_type': random.choices(['page_view', 'click', 'purchase', 'add_to_cart'], weights=[50, 30, 5, 15])[0], 'page_url': random.choice(['/home', '/products', '/cart']), 'timestamp': datetime.utcnow().isoformat() + 'Z', 'metadata': {'amount': round(random.uniform(10, 2000), 2)} if random.random() < 0.1 else {}}

    def stream_clickstream(self, rate=10, max_events=None):
        try:
            from kafka import KafkaProducer
            producer = KafkaProducer(bootstrap_servers=['localhost:9092'], value_serializer=lambda v: json.dumps(v).encode('utf-8'))
        except ImportError:
            print(' kafka-python not installed')
            return self._stream_to_file(rate, max_events)
        count = 0
        filepath = OUTPUT_DIR / f'clickstream_{datetime.now():%Y%m%d_%H%M%S}.jsonl.gz'
        with gzip.open(filepath, 'at', encoding='utf-8') as f:
            try:
                while True:
                    if max_events and count >= max_events:
                        break
                    event = self.generate_clickstream()
                    producer.send('clickstream-events', value=event)
                    f.write(json.dumps(event) + '\n')
                    count += 1
                    if count % 100 == 0:
                        print(f' {count} events')
                    time.sleep(1.0 / rate)
            except KeyboardInterrupt:
                print(f'\n Stopped. Total: {count}')
            finally:
                producer.flush()
                producer.close()

    def _stream_to_file(self, rate, max_events):
        count = 0
        filepath = OUTPUT_DIR / f'mock_{datetime.now():%Y%m%d_%H%M%S}.jsonl'
        with open(filepath, 'a', encoding='utf-8') as f:
            try:
                while True:
                    if max_events and count >= max_events:
                        break
                    f.write(json.dumps(self.generate_clickstream()) + '\n')
                    count += 1
                    if count % 100 == 0:
                        print(f' {count} events')
                    time.sleep(1.0 / rate)
            except KeyboardInterrupt:
                print(f'\n Stopped. Total: {count}')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', default='all', choices=['all', 'batch', 'stream', 'iot', 'logs'])
    parser.add_argument('--rate', type=float, default=10)
    parser.add_argument('--max-events', type=int, default=None)
    args = parser.parse_args()
    gen = MockDataGenerator()
    if args.mode in ['all', 'batch']:
        customers = [gen.generate_customer(i + 1) for i in range(500)]
        products = [gen.generate_product(i + 1) for i in range(100)]
        import csv
        with open(OUTPUT_DIR / 'customers.csv', 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=customers[0].keys())
            w.writeheader()
            w.writerows(customers)
        with open(OUTPUT_DIR / 'products.csv', 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=products[0].keys())
            w.writeheader()
            w.writerows(products)
        print(f' {len(customers)} customers, {len(products)} products')
    if args.mode in ['all', 'stream']:
        gen.stream_clickstream(args.rate, args.max_events)
if __name__ == '__main__':
    main()