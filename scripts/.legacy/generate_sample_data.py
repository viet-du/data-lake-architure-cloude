import csv
import json
import random
import os
from datetime import datetime, timedelta
from pathlib import Path
random.seed(42)
OUTPUT_DIR = Path(__file__).parent.parent / 'data-samples'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
NUM_CUSTOMERS = 200
NUM_PRODUCTS = 50
NUM_ORDERS = 1000
print(' Sinh customers...')
first_names = ['Nguyen Van', 'Tran Thi', 'Le Hoang', 'Pham Thi', 'Vu Minh', 'Hoang Thi', 'Dang Quang', 'Bui Thi', 'Do Van', 'Ngo Thi']
last_names = ['An', 'Binh', 'Cuong', 'Dao', 'Em', 'Phuong', 'Giang', 'Hai', 'Hoa', 'Khanh']
cities = ['Ha Noi', 'TP HCM', 'Da Nang', 'Hai Phong', 'Can Tho', 'Bien Hoa', 'Hue', 'Nha Trang']
segments = ['VIP', 'Gold', 'Silver', 'Bronze']
customers = []
for i in range(1, NUM_CUSTOMERS + 1):
    customer = {'customer_id': f'C{i:05d}', 'first_name': random.choice(first_names), 'last_name': random.choice(last_names), 'email': f'customer{i}@example.com', 'phone': f'09{random.randint(10000000, 99999999)}', 'city': random.choice(cities), 'age': random.randint(18, 70), 'gender': random.choice(['M', 'F', 'O']), 'segment': random.choice(segments), 'registration_date': (datetime(2023, 1, 1) + timedelta(days=random.randint(0, 600))).strftime('%Y-%m-%d'), 'is_active': random.choices([True, False], weights=[0.8, 0.2])[0]}
    if random.random() < 0.05:
        customer['email'] = customer['email'].replace('@', ' at ')
    if random.random() < 0.02:
        customer['phone'] = ''
    customers.append(customer)
with open(OUTPUT_DIR / 'customers.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=customers[0].keys())
    writer.writeheader()
    writer.writerows(customers)
print(f' {NUM_CUSTOMERS} customers → {OUTPUT_DIR}/customers.csv')
print('\n Sinh products...')
categories = {'Electronics': ['Smartphone', 'Laptop', 'Tablet', 'Headphone', 'Smartwatch'], 'Books': ['Fiction', 'Tech', 'Business', 'Comic', 'Education'], 'Fashion': ['T-Shirt', 'Jeans', 'Sneaker', 'Dress', 'Jacket'], 'Home': ['Lamp', 'Pillow', 'Mug', 'Plant', 'Frame'], 'Sports': ['Ball', 'Racket', 'Yoga Mat', 'Dumbbell', 'Bicycle']}
products = []
for i in range(1, NUM_PRODUCTS + 1):
    category = random.choice(list(categories.keys()))
    subcategory = random.choice(categories[category])
    base_price = {'Electronics': (100, 3000), 'Books': (5, 100), 'Fashion': (10, 500), 'Home': (5, 200), 'Sports': (10, 1000)}[category]
    products.append({'product_id': f'P{i:05d}', 'product_name': f'{subcategory} Model {i}', 'category': category, 'subcategory': subcategory, 'price': round(random.uniform(*base_price), 2), 'cost': round(random.uniform(base_price[0] * 0.4, base_price[1] * 0.6), 2), 'stock_quantity': random.randint(0, 500), 'is_active': random.choices([True, False], weights=[0.85, 0.15])[0], 'rating': round(random.uniform(1.0, 5.0), 1)})
with open(OUTPUT_DIR / 'products.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=products[0].keys())
    writer.writeheader()
    writer.writerows(products)
print(f' {NUM_PRODUCTS} products → {OUTPUT_DIR}/products.csv')
print('\n Sinh orders...')
orders = []
for i in range(1, NUM_ORDERS + 1):
    customer = random.choice(customers)
    num_items = random.choices([1, 2, 3, 4, 5], weights=[0.5, 0.25, 0.15, 0.07, 0.03])[0]
    items = []
    total = 0
    for _ in range(num_items):
        product = random.choice(products)
        qty = random.randint(1, 3)
        subtotal = qty * product['price']
        items.append({'product_id': product['product_id'], 'quantity': qty, 'unit_price': product['price'], 'subtotal': round(subtotal, 2)})
        total += subtotal
    order_date = datetime(2024, 1, 1) + timedelta(days=random.randint(0, 270), hours=random.randint(0, 23))
    orders.append({'order_id': f'O{i:06d}', 'customer_id': customer['customer_id'], 'order_date': order_date.isoformat(), 'items': items, 'num_items': num_items, 'total_amount': round(total, 2), 'status': random.choices(['pending', 'paid', 'shipped', 'delivered', 'cancelled'], weights=[0.1, 0.2, 0.3, 0.35, 0.05])[0], 'payment_method': random.choice(['credit_card', 'debit_card', 'e_wallet', 'bank_transfer', 'cod']), 'shipping_city': customer['city']})
with open(OUTPUT_DIR / 'orders.json', 'w', encoding='utf-8') as f:
    json.dump(orders, f, indent=2, ensure_ascii=False)
print(f' {NUM_ORDERS} orders → {OUTPUT_DIR}/orders.json')
print(f'\n Tất cả data đã sẵn sàng trong {OUTPUT_DIR}/')