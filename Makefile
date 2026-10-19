
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Auto-detect venv: use .venv/bin/python if exists, else system python3
VENV_DIR := .venv
VENV_PYTHON := $(VENV_DIR)/bin/python
ifeq ($(wildcard $(VENV_PYTHON)),)
    PYTHON := python3
    PIP    := pip3
    # Tools: when no venv, fall back to system PATH (less robust, but works if user has global install)
    TOOLS_DIR :=
else
    PYTHON := $(VENV_PYTHON)
    PIP    := $(VENV_DIR)/bin/pip
    # Trailing slash so $(TOOLS_DIR)ruff expands to .venv/bin/ruff (not .venv/binruff)
    TOOLS_DIR := $(VENV_DIR)/bin/
endif
PROJECT     := lakehouse
SRC_DIR     := src
DOCKER_COMPOSE_CORE := docker compose -f docker-compose.yml -f docker-compose-kafka.yml
DOCKER_COMPOSE      := $(DOCKER_COMPOSE_CORE)
# `up`, `down`, `logs` and `ps` use the full local infrastructure stack
# (core + Kafka). `up-api` and `down-api` additionally manage api + web.
# Use `make reset` for the destructive path (down -v + clean mock data).

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install package with dev dependencies into .venv
	$(PIP) install -e ".[dev]"

.PHONY: install-prod
install-prod: ## Install package only (no dev deps) into .venv
	$(PIP) install -e .

.PHONY: env
env: ## Create .env from .env.example if missing
	cp -n .env.example .env || true

.PHONY: health
health: ## Quick health check of all dev endpoints
	@bash scripts/check_dev_links.sh

.PHONY: up
up: ## Start all local Docker tools (core + Kafka)
	$(DOCKER_COMPOSE) up -d
	@echo "Waiting 60s for services..."
	@sleep 60

.PHONY: up-api
up-api: ## Start core stack + Control Plane apps (api + web)
	$(DOCKER_COMPOSE_CORE) -f docker-compose.dev-api.yml up -d
	@echo "Waiting 60s for services..."
	@sleep 60

.PHONY: down
down: ## Stop all local Docker tools (keeps volumes)
	$(DOCKER_COMPOSE) down

.PHONY: down-api
down-api: ## Stop core stack + Control Plane apps (keeps volumes)
	$(DOCKER_COMPOSE) -f docker-compose.dev-api.yml down

.PHONY: logs
logs: ## Tail Docker logs
	$(DOCKER_COMPOSE) logs -f

.PHONY: ps
ps: ## Show Docker container status
	$(DOCKER_COMPOSE) ps

.PHONY: reset
reset: ## DESTRUCTIVE: remove all volumes + mock data (double confirm)
	@bash scripts/reset.sh

.PHONY: clean
clean: reset ## Alias for `make reset` (deprecated name; prefer `make reset`)

.PHONY: mock-retail
mock-retail: ## Generate mock retail data (CSV/JSON)
	$(PYTHON) -m lakehouse.sources.mock.retail_generator

.PHONY: mock-stream
mock-stream: ## Generate mock streaming data
	$(PYTHON) -m lakehouse.sources.mock.generic_generator --mode all

.PHONY: pipeline-batch
pipeline-batch: ## Run end-to-end batch pipeline (Bronze→Silver→Gold)
	bash scripts/run_batch_pipeline.sh --pipeline batch_retail

.PHONY: verify-r2
verify-r2: ## Verify local Spark can write/read a temporary Delta table on R2
	$(PYTHON) scripts/verify_r2.py

.PHONY: pipeline-bronze
pipeline-bronze: ## Run bronze layer ingest only
	bash scripts/run_batch_pipeline.sh --pipeline bronze

.PHONY: pipeline-silver
pipeline-silver: ## Run silver layer (customers) via spark-submit in container
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages io.delta:delta-spark_2.12:3.0.0 \
		/app-src/src/lakehouse/transform/batch/customers_transformer.py

.PHONY: pipeline-gold
pipeline-gold: ## Run gold layer (fact_orders) via spark-submit in container
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages io.delta:delta-spark_2.12:3.0.0 \
		/app-src/src/lakehouse/aggregate/batch/fact_orders_aggregator.py

.PHONY: pipeline-verify
pipeline-verify: ## Verify data exists in MinIO (row counts per layer)
	bash scripts/verify_lake_data.sh

.PHONY: produce-clickstream
produce-clickstream: ## Run clickstream Kafka producer
	bash scripts/produce_kafka.sh clickstream-events 100 10

.PHONY: stream-clickstream
stream-clickstream: ## Run clickstream streaming pipeline via spark-submit
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.6,io.delta:delta-spark_2.12:3.0.0 \
		/app-src/src/lakehouse/pipelines/stream_clickstream.py

.PHONY: aggregate-clickstream-unique
aggregate-clickstream-unique: ## Recompute exact clickstream unique metrics as a batch
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages io.delta:delta-spark_2.12:3.0.0 \
		/app-src/src/lakehouse/aggregate/batch/clickstream_unique_metrics_aggregator.py

.PHONY: stream-ecommerce
stream-ecommerce: ## Run e-commerce streaming pipeline via spark-submit
	docker exec lake-spark-master spark-submit \
		--master spark://spark-master:7077 \
		--packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.6,io.delta:delta-spark_2.12:3.0.0 \
		/app-src/src/lakehouse/pipelines/stream_ecommerce.py

.PHONY: scheduler
scheduler: ## Start crawl scheduler (foreground, all 11 jobs)
	bash scripts/run_crawl_scheduler.sh

.PHONY: scheduler-daemon
scheduler-daemon: ## Start crawl scheduler (background daemon)
	bash scripts/run_crawl_scheduler.sh --daemon

.PHONY: scheduler-stop
scheduler-stop: ## Stop background crawl scheduler
	bash scripts/run_crawl_scheduler.sh --stop

.PHONY: scheduler-list
scheduler-list: ## List all scheduled crawl jobs
	bash scripts/run_crawl_scheduler.sh --list

.PHONY: scheduler-once
scheduler-once: ## Run a single crawl job once (use NAME=xxx)
	bash scripts/run_crawl_scheduler.sh --once "$${NAME:-tiki-smartphone}"

.PHONY: crawl-tiki
crawl-tiki: ## Crawl Tiki.vn (smartphone category, 5 pages)
	$(PYTHON) -m lakehouse.sources.crawlers.tiki_crawler --category smartphone --max-pages 5

.PHONY: crawl-all
crawl-all: ## Crawl all sources (GitHub, Crypto, HackerNews)
	$(PYTHON) -m lakehouse.sources.crawlers.github_crawler
	$(PYTHON) -m lakehouse.sources.crawlers.crypto_crawler
	$(PYTHON) -m lakehouse.sources.crawlers.hackernews_crawler

.PHONY: test
test: ## Run pytest with coverage
	$(PYTHON) -m pytest

.PHONY: test-fast
test-fast: ## Run pytest without coverage
	$(PYTHON) -m pytest --no-cov

.PHONY: lint
lint: ## Run ruff linter
	$(TOOLS_DIR)ruff check src tests

.PHONY: format
format: ## Auto-format with black + ruff fix
	$(TOOLS_DIR)black src tests
	$(TOOLS_DIR)ruff check --fix src tests

.PHONY: typecheck
typecheck: ## Run mypy static type checker
	$(TOOLS_DIR)mypy src

.PHONY: check
check: ## Quick CI gate: lint + format-check + tests (no mutations)
	$(TOOLS_DIR)ruff check src tests
	$(TOOLS_DIR)black --check src tests
	$(PYTHON) -m pytest --no-cov

.PHONY: verify
verify: ## Full integrity check: lint + format + tests + docker compose
	$(TOOLS_DIR)ruff check src tests
	$(TOOLS_DIR)black --check src tests
	$(PYTHON) -m pytest --no-cov -q
	@bash scripts/verify.sh

.PHONY: airflow-trigger
airflow-trigger: ## Trigger the retail ELT DAG
	docker exec lake-airflow-webserver airflow dags trigger retail_elt_dag

.PHONY: databricks-bootstrap
databricks-bootstrap: ## Bootstrap Databricks UC (catalog + 3 schemas + 4 volumes)
	bash scripts/bootstrap_databricks.sh

.PHONY: databricks-dryrun
databricks-dryrun: ## Print resolved storage layout for current ENV (debug helper)
	@if [ "$(ENV)" = "" ] && [ "$$ENV" = "" ]; then \
		echo "Usage: ENV=databricks make databricks-dryrun   (or ENV=local)"; \
		exit 1; \
	fi
	@if [ "$$ENV" != "" ]; then export ENV=$$ENV; fi
	@PYTHONPATH=src $(PYTHON) -c "from lakehouse.run_on_databricks import show_storage_layout; show_storage_layout()"

.PHONY: databricks-diag
databricks-diag: ## Quick auth diagnostic against DATABRICKS_HOST (no token print)
	bash scripts/diag_databricks.sh

.PHONY: spark-shell
spark-shell: ## Open interactive PySpark shell
	$(PYTHON) -c "from lakehouse.core.spark import shell; shell()"

.PHONY: clean-pyc
clean-pyc: ## Remove __pycache__ and .pyc files
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

.PHONY: experiment-01
experiment-01: ## Experiment 01: schema evolution, time travel, OPTIMIZE
	$(PYTHON) -m experiments.exp01_schema_evolution_time_travel

.PHONY: experiment-02
experiment-02: ## Experiment 02: ETL vs ELT comparison
	$(PYTHON) -m experiments.exp02_etl_vs_elt

.PHONY: experiment-03
experiment-03: ## Experiment 03: ingest/transform/query/OPTIMIZE/partition-pruning benchmark
	$(PYTHON) -m experiments.exp03_performance_bench

.PHONY: demo
demo: ## Local console demo: Bronze -> Silver -> Gold (no Docker, just Java + Python)
	$(PYTHON) -m experiments.demo_local_pipeline
