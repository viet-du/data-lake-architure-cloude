from __future__ import annotations
import csv
import json
import logging
import random
from datetime import datetime, timedelta
from pathlib import Path
logger = logging.getLogger(__name__)

class RetailMockGenerator:
    DEFAULT_CONFIG = {'num_customers': 200, 'num_products': 50, 'num_orders': 1000, 'output_dir': 'data-samples'}
    FIRST_NAMES = ['Nguyen Van', 'Tran Thi', 'Le Hoang', 'Pham Thi', 'Vu Minh', 'Hoang Thi', 'Dang Quang', 'Bui Thi', 'Do Van', 'Ngo Thi']
    LAST_NAMES = ['An', 'Binh', 'Cuong', 'Dao', 'Em', 'Phuong', 'Giang', 'Hai', 'Hoa', 'Khanh']
    CITIES = ['Ha Noi', 'TP HCM', 'Da Nang', 'Hai Phong', 'Can Tho', 'Bien Hoa', 'Hue', 'Nha Trang']
    SEGMENTS = ['VIP', 'Gold', 'Silver', 'Bronze']
    CATEGORIES = {'Electronics': ['Smartphone', 'Laptop', 'Tablet', 'Headphone'], 'Fashion': ['Shirt', 'Pants', 'Shoes', 'Bag'], 'Home': ['Cookware', 'Furniture', 'Decor']}
    PAYMENT_METHODS = ['COD', 'Credit Card', 'Bank Transfer', 'E-Wallet']

    def __init__(self, *, output_dir: str | Path='data-samples', num_customers: int=200, num_products: int=50, num_orders: int=1000, seed: int=42) -> None:
        random.seed(seed)
        self.seed = seed
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.num_customers = num_customers
        self.num_products = num_products
        self.num_orders = num_orders

    def generate_all(self) -> None:
        logger.info(' Generating mock retail data...')
        self.generate_customers()
        self.generate_products()
        self.generate_orders()
        logger.info(' Mock data generated at %s', self.output_dir)

    def generate_customers(self) -> Path:
        path = self.output_dir / 'crm' / 'customers.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        customers = []
        for i in range(1, self.num_customers + 1):
            customers.append({'customer_id': f'C{i:05d}', 'first_name': random.choice(self.FIRST_NAMES), 'last_name': random.choice(self.LAST_NAMES), 'email': f'customer{i}@example.com', 'phone': f'+84{random.randint(900000000, 999999999)}', 'age': random.randint(18, 70), 'city': random.choice(self.CITIES), 'segment': random.choice(self.SEGMENTS), 'registration_date': (datetime.now() - timedelta(days=random.randint(30, 1000))).isoformat()})
        self._write_csv(path, customers)
        logger.info(' Generated %d customers → %s', len(customers), path)
        return path

    def generate_products(self) -> Path:
        path = self.output_dir / 'erp' / 'products.csv'
        path.parent.mkdir(parents=True, exist_ok=True)
        products = []
        for i in range(1, self.num_products + 1):
            category = random.choice(list(self.CATEGORIES.keys()))
            subcategory = random.choice(self.CATEGORIES[category])
            cost = round(random.uniform(10, 1000), 2)
            price = round(cost * random.uniform(1.2, 2.5), 2)
            products.append({'product_id': f'P{i:04d}', 'product_name': f'{subcategory} {i}', 'category': category, 'subcategory': subcategory, 'price': price, 'cost': cost, 'stock_quantity': random.randint(0, 500), 'brand': random.choice(['Apple', 'Samsung', 'Sony', 'Xiaomi', 'Generic'])})
        self._write_csv(path, products)
        logger.info(' Generated %d products → %s', len(products), path)
        return path

    def generate_orders(self) -> Path:
        path = self.output_dir / 'erp' / 'orders.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        orders = []
        for i in range(1, self.num_orders + 1):
            customer_id = f'C{random.randint(1, self.num_customers):05d}'
            product_id = f'P{random.randint(1, self.num_products):04d}'
            quantity = random.randint(1, 5)
            unit_price = round(random.uniform(10, 1000), 2)
            orders.append({'order_id': f'O{i:06d}', 'customer_id': customer_id, 'order_date': (datetime.now() - timedelta(days=random.randint(0, 365))).isoformat(), 'status': random.choice(['completed', 'pending', 'shipped', 'cancelled']), 'payment_method': random.choice(self.PAYMENT_METHODS), 'shipping_city': random.choice(self.CITIES), 'total_amount': round(quantity * unit_price, 2), 'product_id': product_id, 'quantity': quantity, 'unit_price': unit_price, 'line_total': round(quantity * unit_price, 2)})
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
        logger.info(' Generated %d orders → %s', len(orders), path)
        return path

    @staticmethod
    def _write_csv(path: Path, rows: list[dict]) -> None:
        if not rows:
            return
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    generator = RetailMockGenerator()
    generator.generate_all()
if __name__ == '__main__':
    main()