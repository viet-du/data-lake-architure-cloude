# Hybrid Cloud Architecture — Cloudflare R2 (Storage) + Render (Compute)

> **Status:** **Architecture decision record (ADR).** Supersedes PHASE_9 §3-§4 for production deployment. PHASE_9 GCP plan is kept as fallback only.
> **Decision date:** 2026-10-18
> **Decision owner:** project owner
> **Revised 2026-10-18:** Switched compute layer from Northflank to Render.com for simpler free-tier access and unified Cron-as-a-Service model.

---

## 1. Why a hybrid split?

This project has two very different runtime profiles that benefit from different hosting models:

| Profile | Workload | Cost pattern | Best fit |
| --- | --- | --- | --- |
| **Storage** | Delta tables (bronze/silver/gold), user uploads, snapshot files | Pay-per-GB, **no compute**, **zero egress** | Cloudflare R2 (S3-compatible, 0$ egress = the single biggest R2 advantage over S3/GCS) |
| **Compute** | Batch ETL jobs (Spark on demand), REST API, optional Web UI | Pay-per-CPU-hour, **mostly idle**, **stateless** | Render (managed containers, free tier, cron jobs native) |

The previous Northflank plan used Kubernetes-style multi-service (Spark master + workers + Airflow + Kafka + MinIO inside a private cluster). For an internal **backend tool** that runs batch jobs on a schedule and exposes a REST API, Render's simpler model (1 Web Service + 2 Cron Jobs + 1 Postgres) is sufficient and dramatically cheaper. The 0$ R2 egress still applies — the API and Spark both read gold tables for free.

The split fixes that:

- R2 keeps data **forever** (or until lifecycle policy) regardless of any compute outage.
- Render services can be **rebuilt, scaled, paused** without touching the data.
- The 0$ R2 egress means the **API + Web UI can read every gold table on every page load** for free.
- Render Cron Jobs replace Airflow for simple schedules (no Airflow server cost); add Airflow later only if DAG UI / complex dependencies are needed.

---

## 2. Topology

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                        │
│                  https://<web-domain>  (Cloudflare Pages or R2 static)       │
└────────────────────────────────────────┬─────────────────────────────────────┘
                                         │ HTTPS (R2 cached)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE R2  (storage layer, 0$ egress)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  bronze-bucket  │  │  silver-bucket  │  │  gold-bucket    │  ...         │
│  │  Delta + JSON   │  │  Delta + Parq.  │  │  Delta + Iceb.? │              │
│  │  lifecycle:     │  │  lifecycle:     │  │  lifecycle:     │              │
│  │    30d → IA     │  │    90d → IA     │  │    365d → IA   │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│  ┌─────────────────┐  ┌─────────────────┐                                     │
│  │  scripts-bucket │  │  snapshots-bkt  │  (R2 custom domain:                │
│  │  Airflow DAGs   │  │  parquet/duckdb │   https://<r2-domain>.r2.dev)     │
│  └─────────────────┘  └─────────────────┘                                     │
└────────────────────────────────────────┬─────────────────────────────────────┘
                                         ▲
                                         │ S3A (over HTTPS, IAM-via-R2-token)
                                         │ Delta Lake reads/writes
                                         │
┌────────────────────────────────────────┴─────────────────────────────────────┐
│         RENDER  (compute + managed Postgres, multi-service)                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Project: lakehouse-prod                                            │    │
│  │  Region: us-east-1 (closest to R2 endpoint latency <50ms)           │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│    │
│  │  │ lake-minio   │  │ lake-kafka   │  │ lake-postgres│  │lake-mongo││    │
│  │  │ MinIO :9000  │  │ Redpanda:9092│  │ Postgres:5432│  │ :27017  ││    │
│  │  │ (PVC 50Gi)   │  │ (PVC 20Gi)   │  │ (PVC 10Gi)   │  │ (PVC 5G)││    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│    │
│  │  │ lake-redis   │  │ lake-spark-  │  │ lake-airflow │  │ lake-api ││    │
│  │  │ Redis:6379   │  │ master+worker│  │ web+scheduler│  │ Next.js  ││    │
│  │  │ (PVC 2Gi)    │  │ Spark :7077  │  │ Airflow:8088 │  │ :3001   ││    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│    │
│  │                                                                      │    │
│  │  All services join a private overlay network.                       │    │
│  │  Only the API + Airflow web + Metabase expose public ingress.       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                                         ▲
                                         │ Internal ingress (cluster-only)
                                         │
              ┌──────────────────────────┴──────────────────────────┐
              │                                                     │
              ▼                                                     ▼
      ┌──────────────┐                                       ┌──────────────┐
      │  Web crawler │  (GitHub Actions cron,                │  Metabase    │
      │  workers     │   runs crawlers + pushes to Kafka)    │  :3000       │
      │  (ephemeral) │                                       │  (optional)  │
      └──────────────┘                                       └──────────────┘
```

**Important:** Spark on Render runs in **local mode** (`--master local[*]`) inside each cron job container. There is no long-running Spark master; every job boots Spark, runs the batch, and exits. This is fine for batch ETL on small-to-medium data (<10 min, <4GB RAM). For streaming, add a long-running Spark Web Service later (out of scope for the minimal setup). R2 is the **durable cold tier**. Spark uses MinIO for streaming checkpoints (low-latency, in-cluster) and R2 for batch read/write (durable, cross-region).

---

## 3. Why this split (rationale, not vendor pitch)

### 3.1 Why R2 for storage, not S3 / GCS / MinIO

| Criterion | R2 | S3 | GCS | MinIO (self-hosted) |
| --- | --- | --- | --- | --- |
| Storage per GB/mo | $0.015 | $0.023 | $0.020 | $0 (but disk-bound) |
| **Egress per GB** | **$0** | $0.09 | $0.12 | $0 (but bandwidth-bound) |
| API compatible with S3A | ✅ | ✅ | ✅ (s3a over gcs) | ✅ |
| Multi-region replication | ✅ (automatic, free for same-region reads) | ✅ ($0.02/GB replicated) | ✅ (multi-region) | ❌ (manual) |
| Lifecycle rules | ✅ | ✅ | ✅ | ❌ |
| Pre-signed URLs | ✅ (S3 v4 sig) | ✅ | ✅ (v2/v4) | ✅ |
| Operation cost | Pay only for storage + class A ops ($0.36/M) | Pay for storage + every operation + egress | Pay for storage + every operation + egress | Pay for compute 24/7 |
| Bound to a VM lifecycle | ❌ | ❌ | ❌ | ✅ (lost when VM goes) |

**The 0$ egress is the only reason this works.** Every read by the Web UI, every page-load of a gold table preview, every Parquet query through DuckDB → R2 costs nothing. With S3 the same workload would cost $5-50/mo in egress.

### 3.2 Why Render for compute, not ECS / GKE / Cloud Run / Railway / Fly

| Criterion | Render | ECS | GKE | Cloud Run | Railway | Fly.io |
| --- | --- | --- | --- | --- | --- | --- |
| Web Service free tier | ✅ Starter (sleeps) | ❌ | $300 credit (90d) | ✅ 2M requests/mo | $5 credit/mo | ✅ 3 shared VMs |
| Dockerfile passthrough | ✅ | ✅ | ✅ | ✅ (with caveats) | ✅ | ✅ |
| Managed Postgres free tier | ✅ 90 days | ❌ | ⚠️ Cloud SQL $ | ❌ | ⚠️ trial only | ❌ |
| Cron / scheduled jobs | ✅ native | ⚠️ EventBridge | ✅ | ✅ (Cloud Scheduler) | ✅ | ⚠️ external |
| Auto-scaling | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Multi-region failover | ✅ (paid) | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Bring-your-own Docker image (GHCR/DockerHub) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blueprint / IaC | ✅ (render.yaml) | ⚠️ CDK | ✅ Terraform | ✅ Terraform | ✅ | ⚠️ |
| Service sleep on free tier | ⚠️ 15min idle | n/a | n/a | n/a | ⚠️ 5min idle | n/a |

**Render's killer feature for us:** the `render.yaml` Blueprint declares all services + databases in one file (like `docker-compose.yml`). We push it to GitHub, connect the repo in Render dashboard, and the entire backend stack is provisioned in 5 minutes. For an internal backend tool this beats both Northflank (more complex) and manual Cloud Run setup (more glue code).

### 3.3 What does NOT change between local and Render

The following are **identical** in local dev and cloud:

- `docker-compose.yml` and `docker-compose-kafka.yml` and `docker-compose.dev-api.yml`
- All `Dockerfile.*` and `apps/*/Dockerfile`
- All `src/lakehouse/**` Python code
- All `airflow_dags/**` DAG files (used only if Airflow is added to Render later)
- All `tests/**` (run via CI on push)

What changes:

- `.env` (the git-ignored one) — swap MinIO endpoint → R2 endpoint, add R2 keys.
- One extra file: `render.yaml` (Render Blueprint: web service + cron jobs + managed Postgres).
- One extra file: `infra/r2/lifecycle.json` (R2 bucket lifecycle policy, applied via `wrangler` or dashboard).

---

## 4. Service-to-host mapping (the single source of truth)

| Service | Local (Docker) | Cloud (Render) | R2 role |
| --- | --- | --- | --- |
| **Postgres** (API sessions, control plane state) | `lake-postgres` container | **Render managed DB** `lake-postgres` | n/a |
| **Mongo** (crawler state, optional) | `lake-mongo` container | **Render Private Service** `lake-mongo` (if used) | n/a |
| **Redis** (cache, rate limit, optional) | `lake-redis` container | **Render Key Value Store** `lake-redis` (if used) | n/a |
| **MinIO** (local dev only) | `lake-minio` container | **Not on Render** — replaced by direct R2 writes | n/a |
| **Kafka** (Redpanda) | `lake-kafka` container | **Render Private Service** `lake-kafka` (only if streaming is needed) | n/a |
| **Spark** (batch ETL) | `lake-spark-master` + `lake-spark-worker` | **Render Cron Job** `lake-retail-etl` (Spark local mode) | **Reads/writes Delta tables to R2** |
| **R2 sync** (MinIO → R2 mirror) | n/a (local) | **Render Cron Job** `lake-r2-sync` (every 5min) | Source/target |
| **Airflow** (optional DAG UI) | `lake-airflow-webserver` + `lake-airflow-scheduler` | **Render Web Service** `lake-airflow` (only if DAG UI is needed) | DAG scripts pulled from `scripts-bucket` |
| **API** (Next.js 15 control plane) | `lake-api` container | **Render Web Service** `lake-api` (public URL) | Reads previews/manifests from R2 (zero-egress) |
| **Web** (React 19 + Vite) | `lake-web` container | **Cloudflare Pages** (NOT Render) | Static assets already in R2 / Pages |
| **Crawlers** | Foreground in container or scheduler | GitHub Actions cron → calls Render API endpoint | Raw crawler output to Kafka or R2 |

---

## 5. Secret flow (the only thing that matters for security)

Cloud secrets live in **three** places, in this priority order:

1. **Render dashboard env vars** (per-service, encrypted at rest, masked in UI)
2. **GitHub Actions secrets** (for cron jobs that trigger the API)
3. **R2 token** (scoped per bucket, never `admin:readwrite`)

### 5.1 The 9 secrets to provision

| # | Name | Where | Used by | Notes |
| --- | --- | --- | --- | --- |
| 1 | `R2_ACCOUNT_ID` | Render env | API, Spark cron | 32-char hex from Cloudflare dashboard right sidebar |
| 2 | `R2_ACCESS_KEY` | Render env | API, Spark cron, sync | Created in R2 → "Manage R2 API Tokens" |
| 3 | `R2_SECRET_KEY` | Render env | API, Spark cron, sync | Same as #2 — pair, not separate |
| 4 | `R2_BUCKET_BRONZE` | Render env | Spark cron | `bronze` (or `<org>-bronze-prod`) |
| 5 | `R2_BUCKET_SILVER` | Render env | Spark cron | `silver` |
| 6 | `R2_BUCKET_GOLD` | Render env | API, Spark cron | `gold` |
| 7 | `R2_BUCKET_SCRIPTS` | Render env | Sync cron | `scripts` (DAG files, only if Airflow is used) |
| 8 | `MONGO_URI` | Render env | API (optional) | Only if crawler state lives in cloud Mongo |
| 9 | `REDIS_PASSWORD` | Render env | API (optional) | Only if Redis is used |

### 5.2 What the API container sees

```yaml
# apps/api Web Service env (Render dashboard or render.yaml)
envVars:
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 3001
  - key: S3_ENDPOINT
    value: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
  - key: S3_ACCESS_KEY
    sync: false   # set in dashboard
  - key: S3_SECRET_KEY
    sync: false
  - key: S3_HEALTH_BUCKET
    value: bronze
  - key: DATABASE_URL          # auto-injected by Render when DB is linked
    fromDatabase:
      name: lake-postgres
      property: connectionString
  - key: API_CORS_ORIGINS      # exact Web UI origin
    sync: false
```

**No public ingress on the data services.** Only the API and (optional) Airflow get public URLs. Postgres, Mongo, Redis, Kafka, MinIO are private or non-existent in this minimal Render setup.

### 5.3 What the Spark cron job sees

`spark-defaults.conf` (baked into the Dockerfile.spark image):

```hocon
spark.hadoop.fs.s3a.endpoint              ${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
spark.hadoop.fs.s3a.access.key            ${R2_ACCESS_KEY}
spark.hadoop.fs.s3a.secret.key            ${R2_SECRET_KEY}
spark.hadoop.fs.s3a.path.style.access     true
spark.hadoop.fs.s3a.connection.ssl.enabled true
spark.hadoop.fs.s3a.impl                  org.apache.hadoop.fs.s3a.S3AFileSystem
spark.hadoop.fs.s3a.aws.credentials.provider org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider
spark.sql.extensions                      io.delta.sql.DeltaSparkSessionExtension
spark.sql.catalog.spark_catalog           org.apache.spark.sql.delta.catalog.DeltaCatalog
spark.delta.logStore.class                org.apache.spark.sql.delta.storage.S3SingleDriverLogStore
# 10x more parallelism than local default (R2 is high-throughput)
spark.sql.shuffle.partitions              200
```

The cron job runs `spark-submit --master local[*]` inside the container. No long-running Spark master is needed for batch jobs that finish in <10 minutes.

---

## 6. Network diagram (what talks to what)

```
                        Cloudflare edge
                              │
   ┌──────────────────────────┼──────────────────────────────────┐
   │                          │                                  │
   │  Web (Pages, R2 static)  │  API (Render public ingress)    │
   │  :443                    │  :443 (TLS terminated by Render)│
   │  ◀──── reads static ────▶│  ◀─── REST calls from Web ──────▶│
   │                          │                                   │
   │  R2 (storage)            │                                   │
   │  ◀──── zero-egress ──────┤──── API reads gold previews ─────▶│
   │  read-only public URL    │                                   │
   │  (optional, gated)       │                                   │
   │                          │                                   │
   │                          │  Render managed + cron jobs       │
   │                          │  ┌─────────────────────────────┐ │
   │                          │  │ lake-retail-etl (cron 6h)   │ │
   │                          │  │  └─ Spark local[*] → R2      │ │
   │                          │  └─────────────────────────────┘ │
   │                          │  ┌─────────────────────────────┐ │
   │                          │  │ lake-r2-sync (cron 5min)    │ │
   │                          │  │  └─ mirror delta files → R2  │ │
   │                          │  └─────────────────────────────┘ │
   │                          │  ┌─────────────────────────────┐ │
   │                          │  │ lake-postgres (managed DB)  │ │
   │                          │  │  └─ linked via DATABASE_URL  │ │
   │                          │  └─────────────────────────────┘ │
   └──────────────────────────┴───────────────────────────────────┘
```

**Two trust zones:**

1. **Public edge (Cloudflare):** Web UI (Pages) + R2 public custom domain (if enabled for previews). WAF + DDoS free with Cloudflare.
2. **Public ingress (Render):** Only the `lake-api` Web Service. TLS by Render Let's Encrypt, rate limiting at the app level (BullMQ).

**Private services (add when needed, billed separately):** Kafka (Private Service $7/mo), Mongo (Private Service $7/mo), Redis (Key Value $10/mo). Render cron jobs do not need private services because they only talk to R2 (public HTTPS) and the managed Postgres (private link).

---

## 7. Data flow examples (concrete reads + writes)

### 7.1 Batch job (Tiki crawl → Bronze → Silver → Gold → R2)

```
1. GitHub Actions cron (every 6h) triggers crawler via Render API
   POST https://lake-api.onrender.com/crawler/tiki-smartphone/run

2. API spawns a one-shot crawl job inside the API container
   → writes raw JSON to Kafka topic `tiki-smartphone` (1MB chunks) — OR —
   → writes raw JSON directly to s3a://bronze/crm/tiki/smartphone/raw/ (if no Kafka)

3. Render cron job `lake-retail-etl` fires every 6h
   → Spark reads from Kafka OR from s3a://bronze/crm/tiki/smartphone/raw/
   → transforms to typed schema
   → writes Delta to s3a://${R2_BUCKET_BRONZE}/crm/tiki/smartphone/_delta_log
   → writes Delta to s3a://${R2_BUCKET_SILVER}/crm/tiki/smartphone/_delta_log
   → writes Delta to s3a://${R2_BUCKET_GOLD}/crm/fact_tiki/_delta_log

4. API reads gold preview (zero-egress R2 read)
   GET https://lake-api.onrender.com/gold/crm/fact_tiki/preview?limit=100
   → S3 SDK → R2 → JSON rows

5. Web UI displays the preview (cached at Cloudflare edge for 60s)
```

### 7.2 Streaming job (clickstream → Kafka → Spark → Bronze/R2) — only if Kafka is added

```
1. Clickstream producer (could be on any host with internet)
   → POSTs events to Kafka topic `clickstream-events` via SASL

2. Spark Structured Streaming job (long-running — needs a non-cron Render service)
   → reads Kafka every trigger interval (5s)
   → micro-batch writes Delta to s3a://${R2_BUCKET_BRONZE}/stream/clickstream/
   → checkpoint state in MinIO (in-cluster) NOT R2 (would be too slow for 5s triggers)

3. Airflow (if added) monitors lag (calls Kafka admin API)
   → if lag > 10k, alert Slack

4. After 24h, MinIO replication job syncs checkpoint to R2
   (rare; only on graceful shutdown for cold-restart recovery)
```

**Streaming requires a long-running Spark service.** On Render that means a non-cron Web Service (`lake-spark-stream`, $7/mo Starter) running 24/7. For an internal backend tool used a few times per day, batch cron jobs are sufficient and 5x cheaper. Add streaming only when there's a real need.

**The 5s streaming checkpoint stays in MinIO** (low-latency, in-cluster). The **batch bronze/silver/gold writes** go to R2 (durable, free egress). This is the **delta lake CDC pattern**: hot tier (MinIO) + cold tier (R2).

### 7.3 MinIO → R2 sync (the glue, when local dev writes to MinIO)

A periodic Render cron job (every 5min) called `lake-r2-sync`:

```python
# lakehouse/sync/r2_replicate.py
import boto3
from lakehouse.core.constants import BRONZE_BUCKET, R2_ENDPOINT

def sync_minio_to_r2():
    """Mirror newly-written MinIO objects to R2 (durable cold tier)."""
    s3_minio = boto3.client("s3", endpoint_url="http://minio:9000", ...)
    s3_r2 = boto3.client("s3", endpoint_url=f"https://{R2_ENDPOINT}", ...)
    for obj in s3_minio.list_objects_v2(Bucket="bronze").get("Contents", []):
        if obj["LastModified"] > last_sync_time:
            copy_source = {"Bucket": "bronze", "Key": obj["Key"]}
            s3_r2.copy(copy_source, BRONZE_BUCKET, obj["Key"])
```

**Trade-off:** eventual consistency (≤5 min lag). Batch jobs write directly to R2, so the lag is **only** for streaming checkpoint state — which is fine because streaming state is reconstructible from Kafka offsets.

---

## 8. Cost projection (the question that matters)

### 8.1 R2 cost (the dominant factor)

| Bucket | Expected size (1y project) | $/mo (R2 standard) | Lifecycle impact |
| --- | --- | --- | --- |
| bronze | 50 GB | $0.75 | After 30d → Infrequent Access: $0.20/mo |
| silver | 20 GB | $0.30 | After 90d → IA: $0.10/mo |
| gold | 10 GB | $0.15 | After 365d → IA: $0.05/mo |
| scripts | 1 GB | $0.015 | (no lifecycle, cheap anyway) |
| snapshots | 5 GB | $0.075 | After 30d → IA: $0.03/mo |
| **Total storage** | **86 GB** | **$1.29** | After lifecycle: **$0.40/mo** |
| **Class A ops (writes)** | ~10k writes/day × 30d | $0.36/M × 0.3M = **$0.11** | |
| **Class B ops (reads)** | ~100k reads/day × 30d | $0.036/M × 3M = **$0.11** | |
| **Egress** | unlimited reads | **$0** | (the whole point) |
| **R2 total** | | **~$1.50/mo at steady state** | |

### 8.2 Render cost (compute)

Render's pricing model (verify on dashboard before apply):

| Resource | What you get | Cost |
| --- | --- | --- |
| **Web Service — Starter** | 0.5 vCPU, 512MB RAM, sleeps after 15min idle | $0/mo |
| **Web Service — Standard** | 1 vCPU, 2GB RAM, always-on | $7/mo |
| **Web Service — Pro** | 4 vCPU, 8GB RAM, always-on | $25/mo |
| **Cron Job — Starter** | Same as Starter Web Service, runs on schedule | $0/mo |
| **Postgres — Free** | 256MB storage, 97MB RAM, 1GB egress | $0/mo (90 days, then $7/mo) |
| **Postgres — Basic** | 1GB storage, 256MB RAM, 5GB egress | $7/mo |
| **Key Value (Redis) — Starter** | 25MB, 50 connections | $0/mo (then $10/mo) |
| **Private Service — Starter** | 0.5 vCPU, 512MB RAM, persistent volume | $7/mo |

**For this project (minimal backend tool):** we can stay on the free tier for the first 90 days. Realistic:

- `lake-api` Web Service: Starter → $0/mo (sleeps after 15min, 750hr/mo cap)
- `lake-retail-etl` Cron Job: Starter → $0/mo (1 cron job free)
- `lake-r2-sync` Cron Job: Starter → $0/mo
- `lake-postgres` managed DB: Free → $0/mo for 90 days, then $7/mo
- Cloudflare R2: see §8.1
- **Total Render:** $0/mo for first 90 days, $7/mo after that

### 8.3 Combined monthly projection

| Scenario | R2 | Render | Total |
| --- | --- | --- | --- |
| Demo (free tier, first 90 days) | $0.50 (prorated) | $0 | **$0** |
| Steady state (Starter web + Basic Postgres) | $1.50 | $7 | **$8.50/mo** |
| Production (Standard web + Basic Postgres + Key Value) | $5 | $24 | **$29/mo** |

**Compare to:**

- Northflank full stateful stack: $30-110/mo (was the previous plan)
- GCP Dataproc + GCS + Pub/Sub: $20-100/mo with cluster-management overhead
- AWS EMR + S3 + MSK: $50-200/mo
- Oracle Always-Free: $0 but capacity waitlist + single-VM SPOF + no R2-style zero-egress

**The R2 + Render combo is the cheapest managed option that gives a real separation of concerns.** 90-day free tier is genuinely $0 — perfect for a backend tool that's only used a few times per week.

---

## 9. Security checklist (the non-negotiable)

- [ ] **R2 token scoped to a single bucket** per service. Spark cron gets `bronze:rw, silver:rw, gold:rw`; API gets `gold:r` only; sync cron gets `bronze:rw, silver:rw, gold:rw`.
- [ ] **No `admin:readwrite` token exists** anywhere. If you accidentally created one in the Cloudflare dashboard, rotate it.
- [ ] **No public R2 bucket** unless you have a specific reason (preview CDN, public assets). Enable `public_access_prevention = "enforced"` by default.
- [ ] **R2 custom domain** (if used) has a Cloudflare Access policy: `email = @yourdomain.com`.
- [ ] **Render env vars** are the only place secrets live. Never commit to git, never put in `render.yaml` (use `sync: false` and set in dashboard).
- [ ] **All Render public services have rate limiting** at the app level (BullMQ rate limiter already in `apps/api`); add Render's edge rate limit if you upgrade to a paid plan.
- [ ] **No public ingress on Postgres / Mongo / Redis / Kafka.** Only the Web Service `lake-api` is public; private services cost extra and are only added when truly needed.
- [ ] **TLS on every public endpoint.** Render provisions Let's Encrypt automatically for `*.onrender.com`; verify with `curl -I https://<api>.onrender.com`.
- [ ] **Cloudflare WAF** enabled on the Web UI domain (free with Pages).
- [ ] **GitHub Actions secrets** (for cron crawlers) are scoped to the specific workflow file, not repo-wide.
- [ ] **No service-account JSON files** in the repo. Use Render's env-var UI for all credentials.

---

## 10. Disaster recovery (the boring important part)

| Failure | Detection | Recovery | RTO | RPO |
| --- | --- | --- | --- | --- |
| Render region down | Health check fails | Render auto-restarts in same region (no multi-region failover on free tier) | 5 min | 0 (R2 has data) |
| Web Service OOM | Render logs OOMKilled | Render auto-restarts; upgrade to Standard plan for more RAM | 1 min | 0 (R2 has output) |
| Spark cron OOM | Job exits with code 137 | Edit `render.yaml` → bump plan to Standard, push to redeploy | 1 min | 0 (R2 has output) |
| Postgres corruption | Render managed DB alert | Restore from automatic backup (daily snapshot, 7-day retention) | 1 hour | 24h |
| R2 accidental delete | R2 versioning enabled (configure in dashboard) | Restore via `wrangler r2 object put` from version | 30 min | 1 versioning interval (default 1s) |
| R2 region disaster | R2 multi-region (paid feature) | Failover to secondary region | 1 hour | 0 (async replicated) |
| All Render services wiped | Manual redeploy | Push to main → Render auto-rebuilds from `render.yaml`; R2 has all batch output | 5 min | 0 |

**RPO = 0** for everything that writes to R2 (batch bronze/silver/gold).
**RPO = 24h** for control plane state (Postgres managed DB backup cadence).

---

## 11. Migration path (local → cloud, no downtime)

### 11.1 One-time setup

```bash
# 1. Sign up at render.com (GitHub login)
# 2. Dashboard → "New" → "Blueprint" → select repo viet-du/data-lake-architure-cloude
# 3. Render reads render.yaml, creates all services + databases
# 4. Set env vars marked sync: false (S3_ACCESS_KEY, S3_SECRET_KEY, etc.)

# 5. Create R2 buckets (Cloudflare dashboard or wrangler):
wrangler r2 bucket create bronze
wrangler r2 bucket create silver
wrangler r2 bucket create gold
wrangler r2 bucket create scripts

# 6. Create R2 API token (scoped per §9)

# 7. Apply R2 lifecycle policy (file: infra/r2/lifecycle.json)
wrangler r2 bucket lifecycle set bronze --policy infra/r2/lifecycle-bronze.json
wrangler r2 bucket lifecycle set silver --policy infra/r2/lifecycle-silver.json
wrangler r2 bucket lifecycle set gold  --policy infra/r2/lifecycle-gold.json

# 8. (Optional) First data migration from local MinIO to R2 — see §11.3
```

### 11.2 Per-deploy hook (auto-deploy is on by default)

Every push to `main` triggers a rebuild + redeploy of the affected services (free on Render). No webhook needed. For manual deploy:

```bash
# In CI (after `pnpm run build:all` passes):
- name: Trigger Render deploy
  run: |
    curl -X POST https://api.render.com/deploy/srv-$RENDER_API_SERVICE_ID?key=$RENDER_DEPLOY_HOOK \
         -H "Accept: application/json"
```

The deploy hook URL is in the Render dashboard under "Settings" for each service.

### 11.3 First-time data migration (local MinIO → R2)

```bash
# One-shot: copy everything from local MinIO to R2
python -m lakehouse.sync.minio_to_r2 \
    --source http://localhost:9000 \
    --target https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com \
    --buckets bronze silver gold
```

After the first migration, Render's `lake-r2-sync` cron job (every 5min) keeps the buckets in sync. Local MinIO is then treated as a **write buffer** only; the cold tier is always R2.

---

## 12. Open questions (for the project owner)

1. **Render plan tier.** Starter (free) gets you through the 90-day window; Standard ($7/mo) is needed for 24/7 uptime after the free tier starts sleeping. Confirm budget.
2. **R2 region.** Each R2 bucket is in a single region, but you can pick `enam` (US), `weur` (EU), `apac` (Asia-Pacific). Pick closest to Render `oregon` region. Default: `enam`.
3. **Multi-region R2.** Costs extra but enables RPO=0 disaster recovery. For demo: skip. For production: enable.
4. **R2 custom domain.** If the Web UI needs to load previews directly from R2 (bypassing the API), enable a custom domain with Cloudflare Access. Adds 30 min of one-time config.
5. **Kafka on Render.** Streaming ingestion is **not** included in the free setup. Add a Private Service `lake-kafka` ($7/mo Starter) only if you actually need streaming; otherwise rely on batch cron jobs only.
6. **Airflow on Render.** DAG UI is not needed if cron jobs are sufficient. Add a Web Service `lake-airflow` ($7/mo Starter) only if you need DAG dependency graphs or backfills.
7. **Compliance.** For demo: none. For production with real data: enable R2 Object Lock (WORM), Render audit log export (paid), and Cloudflare Access with MFA.
8. **Cost ceiling.** Set a $20/mo budget alert in the Cloudflare dashboard AND in Render. Both have billing alerts; configure both.
9. **Decommission plan.** When you stop using the cloud stack: delete the Render services, then delete the R2 buckets. Verify both are empty with `wrangler r2 bucket list` and the Render dashboard.

---

## 13. What this doc does NOT cover (explicit out-of-scope)

- **Production HA / multi-region failover** beyond §10. That's a separate doc.
- **CI/CD pipeline** beyond §11.2. A full GitHub Actions workflow with build + push + deploy is a separate doc.
- **Observability** (Prometheus, Grafana, OpenTelemetry). The current stack only has health endpoints; production needs metrics.
- **Disaster-recovery drill** (you actually fail a region and measure RTO). This doc describes the plan; running the drill is a separate effort.
- **Cost optimization beyond §8.** (E.g. R2 reserved capacity, Render committed-use discount.) Not worth the complexity for a $10-30/mo project.

---

## 14. Doc maintenance

- **Owner:** project owner
- **Review cadence:** every 6 months or when any of (Render plan, R2 pricing, project structure) changes
- **Supersedes:** PHASE_9 §3.2 (Oracle Cloud VM) and §4.1 (Oracle recommendation) for production deployment; previous `CLOUD_R2_NORTHFLANK.md` (2026-10-18) — switched to Render for simpler free-tier access.
- **Kept as fallback:** PHASE_9 §1 (GCP inventory) — usable as a plan-B if Northflank is unavailable
- **Related docs:**
  - `docs/architecture/ARCHITECTURE.md` — overall system architecture
  - `docs/architecture/medallion.md` — bronze/silver/gold data model
  - `docs/architecture/STREAMING_SEMANTICS.md` — Kafka + Spark streaming patterns
  - `docs/operations/E2E_RUNBOOK.md` — operational runbook
  - `docs/operations/DEV_LINKS.md` — local dev links (update with cloud URLs after deploy)
