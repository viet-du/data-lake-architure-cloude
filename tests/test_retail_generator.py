import json
from pathlib import Path
import pytest
from lakehouse.sources.mock.retail_generator import RetailMockGenerator

class TestRetailMockGenerator:

    def setup_method(self) -> None:
        self.tmp_dir = Path('/tmp/lakehouse_test')
        self.tmp_dir.mkdir(parents=True, exist_ok=True)

    def teardown_method(self) -> None:
        import shutil
        if self.tmp_dir.exists():
            shutil.rmtree(self.tmp_dir)

    def test_generate_all(self) -> None:
        gen = RetailMockGenerator(output_dir=self.tmp_dir, num_customers=10, num_products=5, num_orders=20)
        gen.generate_all()
        assert (self.tmp_dir / 'crm' / 'customers.csv').exists()
        assert (self.tmp_dir / 'erp' / 'products.csv').exists()
        assert (self.tmp_dir / 'erp' / 'orders.json').exists()

    def test_generate_customers_count(self) -> None:
        gen = RetailMockGenerator(output_dir=self.tmp_dir, num_customers=15, num_products=1, num_orders=1)
        path = gen.generate_customers()
        assert path.exists()
        lines = path.read_text().strip().split('\n')
        assert len(lines) == 16

    def test_generate_products_count(self) -> None:
        gen = RetailMockGenerator(output_dir=self.tmp_dir, num_customers=1, num_products=7, num_orders=1)
        path = gen.generate_products()
        assert path.exists()
        lines = path.read_text().strip().split('\n')
        assert len(lines) == 8

    def test_generate_orders_valid_json(self) -> None:
        gen = RetailMockGenerator(output_dir=self.tmp_dir, num_customers=1, num_products=1, num_orders=5)
        path = gen.generate_orders()
        assert path.exists()
        orders = json.loads(path.read_text())
        assert len(orders) == 5
        assert 'order_id' in orders[0]
        assert 'line_total' in orders[0]

    def test_deterministic_with_seed(self) -> None:
        gen1 = RetailMockGenerator(output_dir=self.tmp_dir / 'r1', num_customers=5, num_products=3, num_orders=2, seed=42)
        gen1.generate_all()
        gen2 = RetailMockGenerator(output_dir=self.tmp_dir / 'r2', num_customers=5, num_products=3, num_orders=2, seed=42)
        gen2.generate_all()
        c1 = (self.tmp_dir / 'r1' / 'crm' / 'customers.csv').read_text()
        c2 = (self.tmp_dir / 'r2' / 'crm' / 'customers.csv').read_text()
        lines1 = c1.strip().split('\n')
        lines2 = c2.strip().split('\n')
        assert len(lines1) == len(lines2)
        for (l1, l2) in zip(lines1, lines2):
            assert l1.split(',')[0] == l2.split(',')[0]