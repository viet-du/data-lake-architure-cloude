# PHASE 5 — Airflow Orchestration Audit

> **Audit date:** 2026-10-16
> **Scope:** `airflow_dags/*`, `Dockerfile.airflow`, `docker-compose.yml` (Airflow services), `pyproject.toml`, scripts, DAG docs
> **Status of stack at audit time:** Docker daemon not reachable from this sandbox (`permission denied while trying to connect to the docker API at unix:///Users/mac/.docker/run/docker.sock`). All "live" tests therefore NOT RUN; static analysis + log analysis only.

---

## 1. Inventory

### 1.1 DAGs actually shipped

| `dag_id`             | File                                            | Schedule         | Tasks | Retries | Notes                                                                                                                          |
| -------------------- | ----------------------------------------------- | ---------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `retail_elt_dag`     | `airflow_dags/retail_elt_dag.py`                | `timedelta(hours=24)` | 11    | 1       | Health check + mock gen + 3× Bronze + 3× Silver + 4× Gold. Linear/branched. **Production-like.** |
| `clickstream_streaming_dag` | `airflow_dags/clickstream_streaming_dag.py` | `timedelta(hours=1)`  | 1     | 0       | Single BashOperator → `stream_clickstream.py`. 2h `execution_timeout`. Uses `--packages` (Maven Central at runtime). |
| `ecommerce_streaming_dag`   | `airflow_dags/ecommerce_streaming_dag.py`   | `timedelta(hours=1)`  | 1     | 0       | Single BashOperator → `stream_ecommerce.py`. 2h `execution_timeout`. Uses `--packages` (Maven Central at runtime). |
| `crawler_dag`        | `airflow_dags/crawler_dag.py`                   | `timedelta(hours=1)`  | 8     | 2       | 8 parallel `PythonOperator`s calling `CrawlScheduler.run_once(...)`. **NOT in any current doc** (see §1.2). |

### 1.2 Documentation drift (dag_id ↔ docs)

Searched all `*.md` for `dag_id` references. Findings:

| Doc                                                                  | Lists `crawler_dag`? | Lists `retail_elt_dag`? | Lists the 2 streaming DAGs? |
| -------------------------------------------------------------------- | :------------------: | :---------------------: | :------------------------: |
| `README.md`                                                          | No                   | No                      | No                         |
| `docs/operations/DEV_LINKS.md`                                       | **No** (table only shows the 3 DAGs) | Yes | Yes (both) |
| `docs/architecture/ARCHITECTURE.md`                                  | No                   | Yes                     | Yes (under shortened names `clickstream_stream`, `ecommerce_stream`) |
| `docs/architecture/overview.md`                                      | No                   | Yes                     | Yes (both, full names)     |
| `docs/plan/plan_overview/20-backend-nextjs-plan.md`                  | No                   | Yes (24h, 10 tasks — **task count is stale; actual = 11**) | Yes |
| `docs/Ke_hoach_va_prompt_hoan_thien_Data_Lakehouse.md`               | No                   | No (just lists the 2 files) | No (just file list)    |
| `docs/phases/PHASE_4_REPORT.md`                                      | No                   | No                      | Yes (only the 2 streaming) |
| `docs/plan/plan_to_refactor&fix/REFACTOR_NOTES.md` / `RECOVERY_NOTE.md` | No               | Yes (legacy)            | Yes (legacy)               |

**Drift summary:**

- `crawler_dag` is **implemented and parseable but not listed in any current operator-facing doc** (DEV_LINKS, ARCHITECTURE, overview). Only a stale refactor note mentions it.
- `docs/plan/plan_overview/20-backend-nextjs-plan.md:325` claims `retail_elt_dag` has **10 tasks** — the actual count is **11** (1 health_check + 1 generate_sample_data + 3 bronze + 3 silver + 3 gold = 11).
- `docs/architecture/ARCHITECTURE.md:91-92` uses shortened names `clickstream_stream` / `ecommerce_stream` — actual `dag_id`s are `clickstream_streaming_dag` / `ecommerce_streaming_dag`. Cosmetic but should be unified.

### 1.3 Acceptance criterion 1 ("docs list the right DAGs") — **PARTIAL FAIL**

`crawler_dag` needs to be added to `docs/operations/DEV_LINKS.md` and `docs/architecture/ARCHITECTURE.md`. Task count for `retail_elt_dag` needs a +1 fix in `20-backend-nextjs-plan.md`.

---

## 2. Image & dependency wiring

### 2.1 Image

- **Base:** `apache/airflow:2.7.0-python3.11` (Debian-based) → `lake-airflow:2.7.0` (custom).
- **Python:** 3.11 in image; `pyproject.toml` requires `>=3.10`. ✓
- **Java:** OpenJDK 17 (Temurin aarch64 tarball) installed at `/opt/java/openjdk` and symlinked to `/usr/local/bin/java`. ✓ for PySpark local sessions used by `bronze_ingest_*`.
- **Spark JARs:** delta-spark 3.0.0, delta-storage 3.0.0, antlr4-runtime 4.9.3, hadoop-aws 3.3.4, aws-java-sdk-bundle 1.12.367 — all pre-bundled in the pyspark `jars/` dir. ✓ avoids the `--packages` Maven download path that bit the streaming DAGs.

### 2.2 Lakehouse deps (pre-installed in image, mirrors `pyproject.toml`)

`delta-spark==3.0.0`, `kafka-python==2.0.2`, `boto3`, `minio`, `pandas`, `numpy<2`, `pyarrow`, `python-dotenv`, `pydantic>=1.10,<2` (pinned to v1 to match Airflow 2.7), `requests`, `beautifulsoup4`, `fake-useragent`, `great-expectations`, `tenacity`.

**Pydantic is pinned to v1** in the image. `pyproject.toml` allows `pydantic>=1.10,<3`. Acceptable: lakehouse code doesn't import pydantic directly (verified by reading `airflow_dags/*.py` — none import pydantic).

### 2.3 Mount / PYTHONPATH matrix

| Container            | Mount                                                              | `PYTHONPATH` (env)                  | Result                                                                                |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `airflow-webserver`  | `./airflow_dags:/opt/airflow/dags:ro`, `./src:/app-src/src:ro`, `./data-samples:/data-samples` | `/app-src/src`                      | `lakehouse.*` importable inside BashOperator. ✓                                      |
| `airflow-scheduler`  | same                                                               | same                                | same ✓                                                                                |
| `spark-master`       | `./src:/app-src/src:ro`                                            | `/app-src/src` (env in compose)     | Spark driver can import `lakehouse.*`. ✓                                              |

**`/app-src/src` vs `/app-src` path comment in `retail_elt_dag.py`** (lines 81–85): the long comment explaining the mount layout is **correct and matches the actual compose mount** (`./src:/app-src/src:ro`). ✓

### 2.4 Mount → BashOperator paths cross-check

- `bronze_ingest_*` (3 tasks): `python -m lakehouse.ingest.batch.csv_ingestor` and `python -m lakehouse.ingest.batch.json_ingestor` — these run **inside the airflow-webserver container**, with `lakehouse` importable (PYTHONPATH ✓) and the deps installed in the image. ✓
- `silver_*` / `gold_*` (7 tasks): `docker exec lake-spark-master spark-submit ...` against `/app-src/src/lakehouse/transform/batch/*.py` and `/app-src/src/lakehouse/aggregate/batch/*.py`. All 7 files exist (`ls src/lakehouse/transform/batch/` and `ls src/lakehouse/aggregate/batch/` confirm). ✓
- `clickstream_streaming_dag` / `ecommerce_streaming_dag`: `docker exec ... /app-src/src/lakehouse/pipelines/stream_clickstream.py` and `stream_ecommerce.py` — both exist. ✓

### 2.5 BashOperator / Spark driver ambiguity

The streaming DAGs invoke `spark-submit` from **inside the spark-master container** (good) but then request `--master spark://spark-master:7077`. The driver runs as a subprocess of the master. The retail DAGs use `--master local[1]` to avoid resource pressure on a 7.7 GB host (documented in the DAG). The streaming DAGs do **not** apply this mitigation — see §10 risk register.

---

## 3. `docker exec` from inside Airflow

This is the single biggest operational risk in the current DAGs. The retail DAG (8 tasks) and both streaming DAGs (2 tasks) all call `docker exec lake-spark-master spark-submit ...` from a BashOperator.

### 3.1 Requirements that the current setup must satisfy

For `docker exec` to work, the **Airflow container** needs:

1. The `docker` CLI binary.
2. The Docker socket mounted read/write.
3. Permission to talk to that socket (the `airflow` user must be able to use the socket's GID, or the socket must be world-writable, or root).

### 3.2 Current state

- `docker-compose.yml:199-201` and `240-242` mount `/var/run/docker.sock:/var/run/docker.sock` on **both** `airflow-webserver` and `airflow-scheduler`. ✓ (requirement 2)
- `Dockerfile.airflow:43-50` comment says `the airflow base image is Debian-based; we need ... the 'docker' CLI (used by silver/gold BashOperators to exec spark-submit on lake-spark-master)`. **But there is no `apt-get install docker-ce` / `curl -fsSL get.docker.com` step in the Dockerfile.** The image ships with whatever `apache/airflow:2.7.0-python3.11` already provides.
  - The base `apache/airflow` image **does** ship a `docker` binary at `/usr/bin/docker` (it's a dependency for some Airflow providers / CeleryExecutor examples in the dev image), so this is plausible. **Not 100% verifiable from the sandbox** (cannot `docker exec lake-airflow-webserver which docker`).
- Socket permission: the host's `/var/run/docker.sock` is typically `root:docker` with mode `0660`. The `airflow` user (uid 50000 in upstream image) is **not** in the host's `docker` group. This will fail with `permission denied` on the socket unless the socket is world-writable or root is used. **Risk: high — see §10.**

### 3.3 Trade-off: drop `docker exec` and use a different mechanism

The prompt asks: *"if the DAG uses `docker exec`, verify Docker binary, socket mount, permissions and network. Prefer a safer option if appropriate, but present trade-offs first."*

| Option                                                                     | Pros                                                                                                       | Cons                                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(A) Keep `docker exec` from BashOperator** (current)                     | Smallest diff; matches the operational `make pipeline-silver/gold` script exactly.                         | Requires `docker` binary in image, **root or docker-GID membership for the `airflow` user**, host socket exposure (escape-to-host surface), DAG run is fragile to socket-permission regressions, logs are split across two containers. |
| **(B) Add a sidecar `airflow-spark-submit` and shell into it via `docker exec`** | Same as (A) but from a controlled image that we own.                                                       | Doesn't actually solve the problem. Same socket exposure.                                                                                                                                                            |
| **(C) Move to a `SparkSubmitOperator` with a `spark-on-k8s` connection**    | Standard, testable, no Docker socket exposure.                                                             | Requires switching to KubernetesExecutor/ClusterExecutor — **explicitly out of scope per the prompt** ("do not upgrade Airflow version or change executor unless proven necessary and a migration plan exists"). |
| **(D) Run spark-submit on the airflow host** (hostPath mount)              | No socket.                                                                                                 | Breaks the "containerized" model; host needs Java + spark-submit installed.                                                                                                                                          |
| **(E) Run spark-submit on the `lake-spark-master` via `SparkSubmitHook` from inside the spark-master container** (best) | No socket mount; the spark-master already has `spark-submit` and all deps; use a sidecar scheduler in the spark image (or a `BashOperator` to a non-Airflow container that hits Airflow's REST API). | Needs a small "trigger" service on the spark image. Bigger refactor. |

**Recommendation:** keep the `docker exec` path **as a stopgap** (option A) because the prompt forbids executor upgrades, but **file a Phase 6 follow-up** to (a) verify the socket permission inside the airflow user, (b) consider moving spark-submit to run on the spark-master host's own cron + Airflow REST callback (or add a `lake-spark-submit` service that owns the JVM lifecycle).

### 3.4 `docker exec` is the most fragile thing in this DAG

A 30-second window in `airflow_logs/dag_processor_manager/dag_processor_manager.log` shows the Airflow scheduler **was already running on this host earlier today** (timestamps `2026-10-16T01:30Z..02:06Z`). During that window:

- The dag_processor_manager log shows `crawler_dag.py` parsing for **1111.95s (~18.5 min)** before being killed. See §6.
- The log also shows `could not translate host name "airflow-db" to address` repeatedly — **the scheduler lost DNS to the postgres container at some point** (likely the host was being torn down or a `docker compose down` was in progress). This is the kind of fragility the audit is trying to surface.

---

## 4. Task dependencies, retries, timeouts, idempotency

### 4.1 `retail_elt_dag`

- **Dependencies:** `health >> generate_data >> [bronze_ingest_customers, bronze_ingest_products, bronze_ingest_json]`; each bronze feeds one silver (linear); silver aggregations feed the golds with a multi-input join for `gold_fact_orders`. ✓ Graph is correct.
- **Retries:** `retries=1, retry_delay=5min`. No `retry_exponential_backoff`. No `execution_timeout` (task-level). **Risk: a hung `spark-submit` (e.g. lost shuffle output on a worker restart) blocks the slot indefinitely.** Recommend adding `execution_timeout=timedelta(minutes=30)` per task and `retry_exponential_backoff=True`.
- **Idempotency:**
  - `generate_sample_data` is **NOT idempotent** — `lakehouse.sources.mock.retail_generator` likely re-writes CSVs/JSONs with new random data each call. **This violates acceptance criterion: "Retry does not double the data beyond design."** A retry of the whole DAG (e.g. bronze_ingest_customers fails twice then succeeds) will write different mock data the second time, then re-ingest it. The 3 bronze tasks are NOT idempotent in their data either — but bronze is **append**, so the table just grows.
  - **Critical: silver + gold rewrites** (Delta `overwrite` mode) will **silently re-aggregate the new mock data** and the gold row counts/dimensions will shift on every retry. This is the data doubling the prompt warns about.
  - **Fix:** separate the mock generation into a **manual one-off step** (or pin a `seed`/timestamp into the generator and version the data dir by run-id). The current DAG couples "recreate input" with "re-process input" which is the wrong contract for a production-like flow.
- **Generate-mock-data separation (criterion 9):** **FAIL.** `generate_data` runs on every DAG run.
- **Health check (criterion 8):** the PythonOperator `health_check` only checks MinIO (`docker exec lake-minio mc ls local/`). It does **not** check that `lake-spark-master` is reachable from inside the webserver (which is what the BashOperators actually need). **Partial pass.**
- **Logs (criterion 10):** airflow ships task logs to `airflow_logs/`; spark-submit logs land in the spark-master container's `work/` or stdout (`docker logs lake-spark-master`). The DAGs do not tee spark-submit output to a file, so a failed task shows the error in the airflow webserver but the full driver log is only in `docker logs lake-spark-master`. **Suboptimal but acceptable for a demo.**

### 4.2 `clickstream_streaming_dag` and `ecommerce_streaming_dag`

- **Single-task DAGs** with `execution_timeout=2h`, `retries=0`. No upstream/downstream.
- **Kafka producer / consumer offsets:** the streaming scripts run continuously and read from Kafka topic offsets. Spark Structured Streaming has its own checkpoint (`/tmp/spark-checkpoints/...` or wherever the script configures) — a retry of the **BashOperator** will start a *new* Spark application, which will resume from the persisted checkpoint. **Net effect: no data loss, but also not a clean "restart"** (depending on the streaming config, you can end up with a duplicate window if the previous run didn't commit). For Structured Streaming with `availableNow` trigger this is fine; for `processingTime` (continuous) it's a wash.
- **Critically, these DAGs use `--packages` (Maven Central at runtime).** The retail DAG explicitly removed `--packages` in commit history (the comment in the file documents why: "transient network failures, sandbox proxy limits"). **The streaming DAGs still have this fragility** and have not been updated. **Inconsistency that should be fixed.**

### 4.3 `crawler_dag`

- **8 tasks, all parallel** (no `>>` operator between them). ✓ matches doc-comment.
- **Retries: 2, retry_delay 5min, execution_timeout 15min.** ✓
- **start_date = 2026-10-01** — **futuristic relative to current 2026-10-16** — but `catchup=False` so no backfill. ✓
- **Idempotency:** crawlers fetch external pages; if the page changes between retries, the payload differs. Acceptable for "ticker" sources (HackerNews, crypto). Slight risk for product catalogs.
- **Side effects to Kafka:** every retry produces more events to `ecommerce-products-stream`, `github-trending-stream`, etc. **A 2-retry failure triples the message volume for that hour.** This is a real "retry multiplies data" bug. Recommend `retries=0` for crawlers that push to Kafka, or have the crawler batch-id embed the run-id and have downstream dedupe.

---

## 5. Schedule, catchup, start_date, timezone

| DAG                       | schedule           | start_date    | catchup | max_active_runs | timezone              |
| ------------------------- | ------------------ | ------------- | ------- | --------------- | --------------------- |
| `retail_elt_dag`          | `timedelta(hours=24)` | 2024-01-01  | False   | (default=16)    | (default=UTC)         |
| `clickstream_streaming_dag` | `timedelta(hours=1)` | 2024-01-01  | False   | (default=16)    | UTC                   |
| `ecommerce_streaming_dag`   | `timedelta(hours=1)` | 2024-01-01  | False   | (default=16)    | UTC                   |
| `crawler_dag`             | `timedelta(hours=1)` | 2026-10-01  | False   | **1** ✓         | UTC                   |

- No `timezone` argument anywhere → all DAGs run in **UTC** (Airflow 2.7 default). Documented in `docs/operations/DEV_LINKS.md` as "Hourly / Daily" without TZ. **Acceptable for a demo but should be explicit.**
- `catchup=False` on all DAGs ✓ (criterion 7).
- `start_date=2024-01-01` for the 3 production-like DAGs is **already in the past** with `catchup=False` → Airflow will immediately try to schedule the first run when the scheduler is healthy. For `retail_elt_dag` (24h cadence) this fires at the next 00:00 UTC; for the streaming DAGs, on the next top of the hour. **In a demo this means the DAG will auto-fire as soon as Airflow is healthy.** This is exactly what the prompt warns about in criterion 7.
- `crawler_dag.start_date=2026-10-01` is in the past too, so it'll fire on the hour after the scheduler comes up.
- **Recommendation:** add an `is_paused_on_creation=True` in each DAG's `DAG(...)` call (Airflow 2.7 supports this) so a fresh deployment doesn't auto-run. Then `make airflow-trigger` or the API can unpause intentionally.

---

## 6. DAG parse / import tests (NOT RUN — Docker not reachable)

Cannot run `airflow dags list` from this sandbox (no Docker). What I can verify statically:

### 6.1 Static importability (file-by-file)

- `retail_elt_dag.py`: imports only `airflow.*`, `datetime`, `subprocess`. No `lakehouse.*` import at module level. ✓
- `clickstream_streaming_dag.py`: imports `from lakehouse.core.constants import DELTA_PACKAGE, KAFKA_PACKAGE` at module level. ✓ (both constants exist in `src/lakehouse/core/constants.py:38-39`).
- `ecommerce_streaming_dag.py`: same as above. ✓
- `crawler_dag.py`: inserts `PROJECT_ROOT/src` into `sys.path` and then `from lakehouse.sources.scheduler import CrawlJob, CrawlScheduler, build_default_scheduler`. **This import path only works inside the airflow container** (where `/app-src/src` is on PYTHONPATH). The `sys.path.insert` is a **defensive belt-and-braces** for local `python airflow_dags/crawler_dag.py` testing — fine but redundant.

### 6.2 Live parse log (from `airflow_logs/dag_processor_manager/dag_processor_manager.log`)

The Airflow webserver/scheduler **was running on this host earlier today** and successfully parsed all 4 DAGs in **sub-second to sub-50s**:

```
retail_elt_dag.py              parse time: 0.99s .. 15.00s  ✓
clickstream_streaming_dag.py   parse time: 37.66s .. 92.08s ✓
ecommerce_streaming_dag.py     parse time: 37.66s .. 956.07s ✓
crawler_dag.py                 parse time: 49.70s .. 1111.95s (KILLED)
```

**`crawler_dag.py` is repeatedly timing out at parse time (~18 min before the manager kills the processor).** Root cause: `BaseCrawler.__init__` calls `self.producer = self._build_producer() if self.kafka_topic else None` (line 38 of `src/lakehouse/sources/crawlers/base.py`). When the scheduler imports the DAG, it executes `build_default_scheduler()` indirectly? No — `build_default_scheduler()` is only called inside the `python_callable` body, not at module level. So why does the import hang?

The hang is more likely the **`from lakehouse.sources.scheduler import ...`** at module level of `crawler_dag.py:39-44`, which pulls in the full `lakehouse.sources.crawlers.*` graph. **One of those crawlers is probably doing network bootstrap at import time** (similar to the pre-existing `crawler_dag` parse test that fails in the pytest output with `kafka.errors.KafkaTimeoutError: Unable to bootstrap from ['localhost:9192']` — see "test result" section above).

**Recommendation:**

1. Make the `crawler_dag` module-level import lighter — only `from lakehouse.sources.scheduler import build_default_scheduler` (already the case, but the transitive `lakehouse.sources.crawlers.*` graph drags in Kafka clients).
2. Move the `build_default_scheduler()` call out of the `python_callable` into a `try/except` that defers Kafka bootstrap to **task execution time** (not parse time). The cleanest fix: import `build_default_scheduler` lazily inside each callable.
3. Verify the same hang does not occur for the streaming DAGs (the log shows their parse times are 37–98s, but they **succeed**; `crawler_dag` is the outlier).

**Caveat:** I haven't proven this root cause from the sandbox (can't run the scheduler), but the log evidence is consistent: every other DAG parses in <100s; `crawler_dag` always times out.

### 6.3 `airflow dags list` / `airflow dags reserialize`

Cannot run; documented in `docs/operations/DEV_LINKS.md:192-193` as the manual recovery command.

---

## 7. Health checks (criterion 8)

- `retail_elt_dag.health_check`: **MinIO only** (via `docker exec lake-minio mc ls local/`). Does **not** check:
  - `lake-spark-master` reachability (the BashOperators need this to succeed).
  - `lake-spark-master` health endpoint (the container exposes `http://localhost:8080`).
  - `airflow-db` (the scheduler's own dependency).
  - Kafka (if any task downstream needs it — currently `retail_elt_dag` does not, so this is fine).
- Streaming DAGs and `crawler_dag` have **no health check** at all.

**Partial pass.** Recommend extending `health_check` to probe all of MinIO + Spark master + (optionally) the airlow-DB ping.

---

## 8. Mock-data separation (criterion 9)

See §4.1 — `generate_sample_data` runs on every DAG trigger and **re-randomises** the mock retail data. This breaks reproducibility and causes bronze/silver/gold row counts to drift between runs.

**Recommendation:** split into two separate operators / DAGs:

- `retail_mock_seed_dag` (manual, one-off): writes `/data-samples/crm/customers.csv` etc. with a **fixed seed** committed to a `seed.txt` next to the file. Idempotent.
- `retail_elt_dag` (scheduled): does **not** call `generate_sample_data`; it just reads from `/data-samples/`. Reproducible.

---

## 9. Logs (criterion 10)

- Airflow task logs: `airflow_logs/<dag_id>/<task_id>/<run_id>.log` ✓ mounted.
- Spark driver logs: land in the **spark-master container's stdout** (`docker logs lake-spark-master`). Not tee'd to a file by the DAG. A failed task shows the error in the airflow webserver log but the **full driver stack trace is only in `docker logs lake-spark-master`**, which is awkward to navigate.
- `docker exec` errors (e.g. socket permission) surface in the airflow task log as `command not found` or `permission denied`. **The error message is not actionable** without also checking the spark-master container's logs.

**Recommendation:** have the BashOperators `2>&1 | tee /opt/airflow/logs/spark/<task>_<run_id>.log` and exit with `${PIPESTATUS[0]}` so the driver output is captured into airflow's log directory.

---

## 10. Risk register (priority order)

| #  | Severity | Issue                                                                                                            | Fix                                                                                                                                            |
| -- | -------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 | **P0**   | `crawler_dag.py` parse hangs 18+ min, repeatedly killed by dag_processor_manager                                  | Lazy-import `build_default_scheduler` inside each `python_callable`; or refactor `BaseCrawler` to skip producer init at import.                  |
| R2 | **P0**   | `retail_elt_dag.generate_sample_data` re-randomises input on every retry → gold aggregates change               | Move mock generation to a separate manual DAG, pin a seed (or commit sample CSVs).                                                              |
| R3 | **P0**   | `docker exec` from airflow container requires `airflow` user to have Docker socket access — **not verified**    | Add a smoke test: `docker exec lake-airflow-webserver docker info`. If it fails, add `USER root` to `Dockerfile.airflow` (with a security note). |
| R4 | **P1**   | Streaming DAGs still use `--packages` (Maven Central at runtime) — known fragile path; retail DAG fixed it       | Remove `--packages` from `clickstream_streaming_dag.py` and `ecommerce_streaming_dag.py`; rely on `spark-sql-kafka` JARs already in `lake-spark:3.5.6`. |
| R5 | **P1**   | `crawler_dag` retries triple Kafka message volume on flapping sources                                             | Set `retries=0` for crawler tasks that produce to Kafka, or add run-id-keyed dedupe in the streaming consumer.                                    |
| R6 | **P1**   | Docs drift: `crawler_dag` not listed; `retail_elt_dag` task count is 11 not 10; `ARCHITECTURE.md` uses shortened names | Update `docs/operations/DEV_LINKS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/overview.md`, `docs/plan/plan_overview/20-backend-nextjs-plan.md`. |
| R7 | **P2**   | `health_check` only probes MinIO, not Spark master                                                                 | Extend to `curl http://lake-spark-master:8080/ && mc ls local/`.                                                                                 |
| R8 | **P2**   | `retail_elt_dag` tasks have no `execution_timeout`; a hung spark-submit blocks the slot                          | Add `execution_timeout=timedelta(minutes=30)` per task; enable `retry_exponential_backoff=True`.                                                |
| R9 | **P2**   | Spark driver logs not captured into airflow's log dir                                                              | `2>&1 | tee /opt/airflow/logs/spark/...` + `exit ${PIPESTATUS[0]}`.                                                                                 |
| R10 | **P2**  | DAGs auto-fire on first scheduler boot (no `is_paused_on_creation`)                                              | Add `is_paused_on_creation=True` to each `DAG(...)`; unpause via `make airflow-trigger` or UI.                                                  |
| R11 | **P3**  | No explicit `timezone` argument                                                                                    | Add `timezone="UTC"` (or `pendulum.timezone("Asia/Ho_Chi_Minh")`) explicitly.                                                                  |
| R12 | **P3**  | `ARCHITECTURE.md` uses shortened DAG names                                                                         | Use full `dag_id` strings to match the code.                                                                                                    |

---

## 11. Test results (NOT RUN)

> **Status: NOT RUN** — Docker daemon not reachable from this sandbox (`permission denied` on `unix:///Users/mac/.docker/run/docker.sock`).

Specifically:

- ❌ `airflow dags list` — not run.
- ❌ `airflow dags reserialize` — not run.
- ❌ `make airflow-trigger` (or `docker exec lake-airflow-webserver airflow dags trigger retail_elt_dag`) — not run.
- ❌ Live DAG run + task state inspection — not run.
- ❌ `verify_lake_data.sh` after a successful DAG run — not run.

**Minimal missing dependencies for live testing (criterion "report exact missing dependency"):**

1. Docker daemon must be reachable from the agent's shell. Currently: `permission denied while trying to connect to the docker API at unix:///Users/mac/.docker/run/docker.sock`.
2. The Airflow image `lake-airflow:2.7.0` must be built (`docker build -f Dockerfile.airflow -t lake-airflow:2.7.0 .`). Status unknown — `docker images` not callable.
3. The Spark image `lake-spark:3.5.6` must be built (`docker build -f Dockerfile.spark-runtime -t lake-spark:3.5.6 .`). Status unknown.
4. The compose stack must be up (`make up`).
5. The `airflow-db` postgres must be migrated (`airflow db init` runs on webserver start; should be done by compose).
6. The `.env` file must define `AIRFLOW_FERNET_KEY` (the compose file uses `${AIRFLOW_FERNET_KEY:?Set AIRFLOW_FERNET_KEY in .env}` — a missing value will refuse to start).

Once those are met, the live test plan is:

```bash
make up                                          # start stack
sleep 60
docker exec lake-airflow-webserver airflow dags list
docker exec lake-airflow-webserver airflow dags reserialize
docker exec lake-airflow-webserver airflow dags trigger retail_elt_dag
docker exec lake-airflow-webserver airflow dags list-runs -d retail_elt_dag
# Watch task state until done (UI: http://localhost:8088)
docker exec lake-airflow-webserver airflow tasks list -d retail_elt_dag
# When all green:
bash scripts/verify_lake_data.sh
```

---

## 12. Acceptance criteria — verdict

| Criterion                                                                 | Verdict                                                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Docs list the correct DAGs**                                            | **PARTIAL FAIL** — `crawler_dag` missing from `DEV_LINKS.md` and `ARCHITECTURE.md`; `retail_elt_dag` task count is off-by-one in the plan doc; shortened names in `ARCHITECTURE.md`. |
| **DAGs parse**                                                            | **PARTIAL FAIL** — 3 of 4 parse in <100s; `crawler_dag.py` parse hangs 18+ min and is repeatedly killed. R1.                                           |
| **One main batch DAG runs successfully** (or specific blocker)            | **NOT RUN** — Docker not reachable; see §11 for the exact missing dependencies. Cannot prove green from sandbox.                                        |
| **Retry does not double data beyond design**                              | **FAIL** — `generate_sample_data` is in the data path of `retail_elt_dag`; crawlers multiply Kafka messages on retry. R2, R5.                          |

**Phase 5 is BLOCKED on:**

1. Live test execution (R-a) — needs Docker daemon reachable from the agent.
2. Fixing R1 (crawler_dag parse hang) before we can claim "DAGs parse" cleanly.
3. Fixing R2 (mock-data separation) before we can claim "retry does not double data".

Once R1, R2, and the Docker access are sorted, the path to "retail_elt_dag runs green" is short: most of the static analysis is positive.

---

## 13. Concrete fix list (small, ordered)

If we want to clear Phase 5 with minimum churn:

1. **R1** — In `airflow_dags/crawler_dag.py`, wrap the `from lakehouse.sources.scheduler import ...` import in a function-scoped try/except OR change the callables to lazy-import. Easiest:

   ```python
   def _crawl_tiki_smartphone(**ctx):
       from lakehouse.sources.scheduler import build_default_scheduler
       return build_default_scheduler().run_once("tiki-smartphone")
   ```

   (Move the import inside the callable; remove the module-level `sys.path.insert` since `/app-src/src` is already on PYTHONPATH inside the container.)

2. **R2** — In `airflow_dags/retail_elt_dag.py`, remove the `generate_data` operator and the `health >> generate_data >> [bronze...]` link. Make it `health >> [bronze...]`. Add a comment pointing operators to `make mock-retail` (already idempotent if the generator respects a fixed seed — needs verification in `src/lakehouse/sources/mock/retail_generator.py`).

3. **R3** — Add a smoke test to `scripts/verify.sh` or a new `scripts/verify_airflow.sh`:
   ```bash
   docker exec lake-airflow-webserver docker info >/dev/null \
     || { echo "FAIL: airflow user cannot talk to Docker socket"; exit 1; }
   ```
   Run it as part of `make verify`. If it fails, the fix is either (a) add `USER root` to `Dockerfile.airflow` (with security note) or (b) `groupadd -g $(stat -c %g /var/run/docker.sock) docker && usermod -aG docker airflow` in the Dockerfile.

4. **R4** — In `clickstream_streaming_dag.py` and `ecommerce_streaming_dag.py`, drop `--packages ...` and drop the `KAFKA_PACKAGE, DELTA_PACKAGE` constants import. The `lake-spark:3.5.6` image already has delta-spark JARs; **but** it does **not** have `spark-sql-kafka-0-10_2.12` JARs (verified by reading `Dockerfile.spark-runtime` — only delta JARs are pre-bundled). So we either (a) add `spark-sql-kafka-0-10_2.12-3.5.6.jar` to the spark image or (b) keep `--packages` for those DAGs only. Recommendation: add the JAR to the spark image (one curl, same pattern as delta).

5. **R5** — In `crawler_dag.py`, set `retries=0` for the 5 tiki tasks (they produce to `ecommerce-products-stream` and `ecommerce-reviews-stream`); keep `retries=2` for the 3 read-only/aggregator sources (github, hackernews, crypto).

6. **R6 (docs)** — Update:
   - `docs/operations/DEV_LINKS.md`: add a row for `crawler_dag`.
   - `docs/architecture/ARCHITECTURE.md`:91-92 — rename to `clickstream_streaming_dag` / `ecommerce_streaming_dag`; add `crawler_dag (hourly, 8 parallel tasks) → sources.crawlers`.
   - `docs/architecture/overview.md`:60 — already correct, but add `crawler_dag`.
   - `docs/plan/plan_overview/20-backend-nextjs-plan.md`:325 — change `10 tasks` to `11 tasks` (or rewrite to reference this audit report).

7. **R7, R8, R9, R10, R11, R12** — small follow-up edits, each is one or two lines.

---

## 14. What I did NOT do

- Did not run any live test (Docker not reachable).
- Did not modify any DAG, compose file, or doc — this is **audit only**. Apply §13 when ready.
- Did not propose an Airflow version upgrade or executor change (per the prompt).
- Did not verify the `docker` binary exists inside `lake-airflow:2.7.0` (cannot `docker run`).
- Did not verify the `airflow` user's GID vs the host's Docker socket GID (cannot `stat` from inside the container).
