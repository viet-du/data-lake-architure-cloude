
SHELL := /bin/bash
.DEFAULT_GOAL := help

PYTHON      := python3
PIP         := pip3
PROJECT     := lakehouse
SRC_DIR     := src
DOCKER_COMPOSE := docker-compose -f docker-compose.yml -f docker-compose-kafka.yml

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install:
	$(PIP) install -e ".[dev]"

.PHONY: install-prod
install-prod:
	$(PIP) install -e .

.PHONY: env
env:
	cp -n .env.example .env || true

.PHONY: up
up:
	$(DOCKER_COMPOSE) up -d
	@echo "Waiting 60s..."
	@sleep 60

.PHONY: down
down:
	$(DOCKER_COMPOSE) down

.PHONY: logs
logs:
	$(DOCKER_COMPOSE) logs -f

.PHONY: ps
ps
	$(DOCKER_COMPOSE) ps

.PHONY: clean
clean:
	$(DOCKER_COMPOSE) down -v
	rm -rf data-samples/*

.PHONY: mock-retail
mock-retail:
	$(PYTHON) -m lakehouse.sources.mock.retail_generator

.PHONY: mock-stream
mock-stream:
	$(PYTHON) -m lakehouse.sources.mock.generic_generator --mode all

.PHONY: pipeline-batch
pipeline-batch:
	$(PYTHON) -m lakehouse.pipelines.batch_retail

.PHONY: pipeline-bronze
pipeline-bronze:
	$(PYTHON) -m lakehouse.ingest.batch.csv_ingestor

.PHONY: pipeline-silver
pipeline-silver:
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages io.delta:delta-spark_2.12:3.0.0 \
		/scripts/lakehouse/transform/batch/customers_transformer.py

.PHONY: pipeline-gold
pipeline-gold:
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages io.delta:delta-spark_2.12:3.0.0 \
		/scripts/lakehouse/aggregate/batch/fact_orders_aggregator.py

.PHONY: producer-clickstream
producer-clickstream:
	$(PYTHON) -m lakehouse.sources.producers.clickstream_producer --rate 10

.PHONY: stream-clickstream
stream-clickstream:
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
		/scripts/lakehouse/pipelines/stream_clickstream.py

.PHONY: stream-ecommerce
stream-ecommerce:
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0,io.delta:delta-spark_2.12:3.0.0 \
		/scripts/lakehouse/pipelines/stream_ecommerce.py

.PHONY: crawl-tiki
crawl-tiki:
	$(PYTHON) -m lakehouse.sources.crawlers.tiki_crawler --category smartphone --max-pages 5

.PHONY: crawl-all
crawl-all:
	$(PYTHON) -m lakehouse.sources.crawlers.github_crawler
	$(PYTHON) -m lakehouse.sources.crawlers.crypto_crawler
	$(PYTHON) -m lakehouse.sources.crawlers.weather_crawler
	$(PYTHON) -m lakehouse.sources.crawlers.hackernews_crawler

.PHONY: test
test:
	pytest

.PHONY: test-fast
test-fast:
	pytest --no-cov

.PHONY: lint
lint:
	ruff check src tests

.PHONY: format
format:
	black src tests
	ruff check --fix src tests

.PHONY: typecheck
typecheck:
	mypy src

.PHONY: check: lint, test-fast

.PHONY: airflow-trigger
airflow-trigger:
	docker exec lake-airflow-webserver airflow dags trigger retail_elt_dag

.PHONY: spark-shell
spark-shell:
	$(PYTHON) -c "from lakehouse.core.spark import shell; shell()"

.PHONY: clean-pyc
clean-pyc:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true