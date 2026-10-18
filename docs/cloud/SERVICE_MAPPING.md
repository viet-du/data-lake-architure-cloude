# Service-to-Host Mapping (Single Source of Truth)

> **What lives where.** This is the table that everyone on the team references when asking "where does X run?"

## Quick reference (TL;DR)

| Need | Where | Cost | Why |
| --- | --- | --- | --- |
| Static web UI (React build) | **Cloudflare Pages** | $0 | Edge cache, global CDN, free tier |
| Persistent storage (Delta tables) | **Cloudflare R2** | $1.50/mo at steady state | Zero egress, S3-compatible |
| Long-running compute (Spark, Airflow, API) | **Render** | $0-7/mo on free/Standard | Cron jobs native, free tier, no multi-service cluster |
| Stateful data services (Kafka, MinIO, Mongo, Redis) | **Render Private Services** (optional) | $7-10/mo each, only if needed | Add later — minimal setup runs without them |
| Crawlers (scheduled jobs) | **GitHub Actions** | $0 (free tier 2000 min/mo) | No always-on cost |
| One-off scripts (data migration, R2 cleanup) | **Render Cron Jobs** | $0 (1 free cron) | Run on schedule, auto-tear-down |

## Detailed service inventory

### 1. Cloudflare R2 (storage)

| Bucket | Content | Read by | Write by | Size (1y) |
| --- | --- | --- | --- | --- |
| `bronze` | Raw Delta tables, Parquet snapshots | Spark (read for Silver transform) | Spark batch + streaming | 50 GB |
| `silver` | Cleaned Delta tables | Spark (read for Gold aggregate) + API (read for catalog) | Spark batch | 20 GB |
| `gold` | Curated Delta tables, KPIs, dimensions | API (read for Web UI previews) | Spark batch | 10 GB |
| `scripts` | Airflow DAG files (synced from git) | Airflow scheduler (pull on schedule) | GitHub Actions (sync on push) | 1 GB |

**Lifecycle:** see `infra/r2/lifecycle-*.json`. Bronze → IA after 30d; Silver → IA after 90d; Gold → IA after 365d.

### 2. Render services (compute + managed Postgres)

| Service name | Type | Plan | Public? | Purpose |
| --- | --- | --- | --- | --- |
| `lake-api` | Web Service | Starter (0.5 vCPU, 512MB) | **Yes** (REST on :3001) | Next.js control plane API |
| `lake-retail-etl` | Cron Job (every 6h) | Starter | No | Spark batch ETL (local mode) |
| `lake-r2-sync` | Cron Job (every 5min) | Starter | No | MinIO → R2 mirror |
| `lake-airflow` | Web Service (optional) | Starter | **Yes** (UI on :8088) | DAG orchestration, only if DAG UI is needed |

**Network rules:**

- Public ingress only on: `lake-api` (and `lake-airflow` if added)
- All other services are internal or non-existent in minimal setup
- All public services get TLS by default (Render Let's Encrypt)
- Rate limiting at the app level (BullMQ in `apps/api`)

### 3. Render managed databases

| Addon | Version | Plan | Used by | Connection var |
| --- | --- | --- | --- | --- |
| `lake-postgres` | 16 | Free (256MB, 90 days) → Basic $7/mo | API sessions, control plane state | `DATABASE_URL` (auto-injected) |

For Mongo and Redis, add as **Private Services** (not free) or use external free tiers (Mongo Atlas free, Upstash Redis free).

### 4. Cloudflare Pages (web UI)

| Project | Build command | Output dir | Custom domain | Deploys on |
| --- | --- | --- | --- | --- |
| `lakehouse-web` | `pnpm --filter web build` | `apps/web/dist` | Optional | Push to `main` branch |

**Env vars (Cloudflare Pages UI):**
- `VITE_API_BASE_URL=https://lake-api.onrender.com`

### 5. GitHub Actions (cron jobs)

| Workflow | Schedule | What it does | Permissions |
| --- | --- | --- | --- |
| `crawl-tiki.yml` | `0 */6 * * *` (every 6h) | POSTs to `lake-api/crawler/tiki-smartphone/run` | `repo:read`, `id-token:write` (for OIDC) |
| `crawl-github.yml` | `0 * * * *` (hourly) | Same for GitHub trending | Same |
| `crawl-hackernews.yml` | `*/30 * * * *` (every 30min) | Same for HackerNews | Same |
| `crawl-crypto.yml` | `*/5 * * * *` (every 5min) | Same for Crypto | Same |
| `sync-dags.yml` | `0 0 * * *` (daily) | `wrangler r2 object put scripts/airflow_dags/...` | `repo:read`, `r2:write` |

**Total GitHub Actions usage:** ~6 hours/day of compute (well under the 2000 min/mo free tier for public repos; private repos get 500 min/mo free).

**Note:** For Render, the same cron jobs are also possible as native **Render Cron Jobs** (cheaper, no GitHub Actions indirection). Use Render Cron Jobs when secrets are already in the Render dashboard; use GitHub Actions when you need external triggers or OAuth flows.

### 6. Local development (Docker Compose)

| Service | Image | Port | Notes |
| --- | --- | --- | --- |
| `lake-minio` | `minio/minio:latest` | 9000 (API), 9001 (console) | Same as cloud, but local |
| `lake-kafka` | `confluentinc/cp-kafka:7.6.0` | 9092 | Local uses Confluent + Zookeeper; cloud uses Redpanda |
| `lake-zookeeper` | `confluentinc/cp-zookeeper:7.6.0` | 2181 | Local only |
| `lake-postgres` | `postgres:16` | 5432 | Same as cloud addon |
| `lake-mongo` | `mongo:7` | 27017 | Same as cloud addon |
| `lake-redis` | `redis:7-alpine` | 6379 | Same as cloud addon |
| `lake-spark-master` | built from `Dockerfile.spark` | 7077, 8080 | Same as cloud |
| `lake-spark-worker` | built from `Dockerfile.spark` | 7078 | Local only (cloud runs driver-only) |
| `lake-airflow-webserver` | built from `Dockerfile.airflow` | 8088 | Same as cloud |
| `lake-airflow-scheduler` | built from `Dockerfile.airflow` | n/a | Same as cloud |
| `lake-api` | built from `apps/api/Dockerfile` | 3001 | Same as cloud |
| `lake-web` | built from `apps/web/Dockerfile` (or `pnpm dev`) | 5173 | Local only (cloud uses Cloudflare Pages) |
| `lake-metabase` | `metabase/metabase:latest` | 3000 | Same as cloud |
| `lake-kafka-ui` | `provectuslabs/kafka-ui:latest` | 8081 | Local only (dev convenience) |

**Key local-vs-cloud differences:**

- Local: Confluent Kafka + Zookeeper (heavier but battle-tested)
- Cloud: Redpanda (lighter, KRaft-only, no Zookeeper)
- Local: Multi-process Spark (master + workers)
- Cloud: Single Spark process (driver-only; runs as `spark-submit --master local[*]`)
- Local: Web UI via Vite dev server
- Cloud: Web UI as static build on Cloudflare Pages

**Code is the same.** All Kafka producers/consumers in `src/lakehouse/` work with both Confluent and Redpanda because both speak the Kafka wire protocol.

---

## Decision matrix (when to put a new service in each host)

| If your service... | Put it in... |
| --- | --- |
| Serves static content (HTML/JS/CSS/images) | Cloudflare Pages (free) |
| Reads/writes Delta tables, Parquet, JSON | R2 (via S3A) |
| Needs a Kafka broker | Render Private Service (when needed) |
| Needs persistent disk for state | Render Private Service (paid) |
| Needs a managed Postgres | Render (managed DB, free 90 days) |
| Needs Mongo/Redis | Render Private Service or external (Atlas/Upstash free tier) |
| Runs on a cron (every N hours/days) | GitHub Actions (free) |
| Runs once and exits (data migration, cleanup) | Render Cron Job |
| Needs global edge cache for read-heavy content | Cloudflare Pages or R2 + custom domain |
| Needs a public REST API | Render Web Service |
| Needs to scale horizontally | Render Web Service (set numInstances: 3) |
| Needs to run Spark code | Render Cron Job (Spark local mode) |
| Needs Airflow DAG scheduling | Render Web Service `lake-airflow` (optional) |
| Is a private internal tool (no public users) | Render Private Service |

---

## When NOT to put something in Render

- **Long-term archival** (multi-year, accessed <1x/year): use R2 with deep-archive storage class (when available) or AWS Glacier.
- **CDN-fronted static assets** (marketing site, blog, docs): use Cloudflare Pages, not Render.
- **DNS or email**: use Cloudflare DNS / Workers Email Routing, not Render.
- **Heavy ML training** (GPU, multi-day jobs): use a dedicated GPU host (Lambda Labs, RunPod, Vast.ai), not Render.
- **Database larger than 100GB**: consider managed Postgres on Neon or Supabase, or a dedicated Postgres host on Hetzner.

---

## What changes when you add a new service to the project

1. **New microservice (e.g. a new "recommendation" API):**
   - Add a new Web Service in Render
   - Add a row to §2 of this doc
   - Add the env vars to the service spec
   - Add the public URL to `docs/operations/DEV_LINKS.md`
  - Or: add a new row to `render.yaml` and push

2. **New database (e.g. ClickHouse for OLAP):**
   - Either: provision a new managed DB in Render (if <1GB) or a new Private Service
   - Or: provision a managed ClickHouse cluster on a dedicated host (Render doesn't have managed ClickHouse)
   - Add a row to §3 of this doc
   - Add the connection var to all consumers (auto-injected as `DATABASE_URL` for managed DBs)

3. **New storage bucket (e.g. for ML training data):**
   - `wrangler r2 bucket create <name>`
   - Add a row to §1 of this doc
   - Add a lifecycle policy in `infra/r2/`
   - Add the bucket name to the secret manager

4. **New cron crawler:**
   - Add a new GitHub Actions workflow in `.github/workflows/`
   - Add a row to §5 of this doc
   - Add the API endpoint to the workflow

No service should be added without updating this table.
