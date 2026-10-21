# Full-stack Data Lake recovery

- **Motivation/Background**: Eleven screens expose missing translations and connectivity failures.
- **Purpose**: Repair confirmed shared defects and verify actual runtime behavior.
- **Overview Pipeline**: Inventory → baseline → root cause → sequential fixes → tests → browser verification.
- **Detailed Plan**: Inventories, root causes, ordered phases, risk register, completion evidence.
- **References**: [Architecture](../../architecture/ARCHITECTURE.md), [API architecture](../../../apps/api/ARCHITECTURE.md), [Markdown convention](../../../.agents/rules/MD_CONVENTION.md).
- **Created**: 2026-10-20T13:20:00+07:00
- **Last Updated**: 2026-10-21T08:33:51+07:00

[STATUS: ACTIVE]

## Executive summary and scope

Repair existing React/Vite UI and Next.js control plane without redesigning the platform or executing production mutations. Credentials stay in ignored server environment files. Databricks credentials do not establish an existing Databricks application integration.

## Architecture and dependency inventory

[Web](../../../apps/web/src/App.tsx) → [Axios services](../../../apps/web/src/services) → [API routes](../../../apps/api/src/app/api) → controllers → services → repositories. MongoDB stores metadata and jobs; Redis/BullMQ queues work; DuckDB reads S3/Delta; KafkaJS accesses broker; Airflow adapter calls its REST API. Python Spark pipelines are separate executors. Schematic is a static diagram.

## Screen inventory and API endpoint matrix

Screen implementations reside in [screens](../../../apps/web/src/screens), query hooks in [queries](../../../apps/web/src/services/queries), HTTP methods/paths in [endpoints](../../../apps/web/src/services/api/endpoints.ts).

| Screen / route | Query/service | Read APIs | Translation group |
|---|---|---|---|
| Home / | home aggregation | layer jobs/stats, catalog/tables, kafka/stats, airflow/stats, dq/summary, health | home |
| Health /health | health | /api/health, /api/health/deep | screens.health |
| Catalog /catalog | catalog | /api/catalog/databases, /api/catalog/tables | screens.catalog |
| Crawler /crawler | crawler | /api/crawler, /api/crawler/stats | screens.crawler |
| Bronze /bronze | bronze | /api/bronze, /api/bronze/jobs, /api/bronze/jobs/stats | screens.bronze |
| Silver /silver | silver | /api/silver, /api/silver/jobs, /api/silver/jobs/stats | screens.silver |
| Gold /gold | gold | /api/gold, /api/gold/jobs, /api/gold/jobs/stats | screens.gold |
| Kafka /kafka | kafka | /api/kafka/topics, consumer-groups, stats | screens.kafka |
| Airflow /airflow | airflow | /api/airflow/dags, stats | screens.airflow |
| DQ /dq | dq | /api/dq/rules, runs, summary | screens.dq |
| Schematic /schematic | static components | none | schematic |

## Baseline and root cause matrix

| Finding | Evidence | Impact |
|---|---|---|
| Missing translation resources | EN/VI omit screens and home stats keys | All screens |
| Fabricated dashboard defaults | Home aggregates rejected requests to zero/healthy; constants have fake activity/trends | Home data integrity |
| Health wire contract mismatch | API ok/down, unnamed services, uptime ms; UI expects healthy/unhealthy, names, seconds | Home/Health |
| API URL/CORS/environment | Dev launcher computes parent incorrectly; routes do not apply CORS; default origins omit Vite | All API callers |
| Response contract drift | Layer list arrays vs UI items; jobs items envelope vs array; catalog database/layers vs name/layer | Business screens |
| Infrastructure port collision | Existing portlink containers own 9000, 27017, 6379, 8088 | Local verification |
| Typecheck target | API ES2017 with BigInt literal code | API typecheck fails |

Baseline: web typecheck passed; web 63 tests passed; API 44 schema tests passed; API typecheck failed on two BigInt literals. Existing tests labeled integration primarily validate Zod schemas, not real service availability. Existing uncommitted environment/lint/Nx edits are preserved.

## Impact analysis and ordered implementation phases

1. Restore complete EN/VI resources; add source-key/parity regression audit.
2. Fix dev environment loading, relative API proxy, explicit CORS, error decoding and compiler target.
3. Correct Home/Health contracts, remove fabricated activity/trends/default healthy states.
4. Sequentially align Catalog, Crawler, Bronze, Silver, Gold, Kafka, Airflow and DQ service adapters with existing backend contracts; keep side-effect actions test-only.
5. Fix Schematic height/overflow and shared responsive issues without changing pipeline relations.
6. Run typecheck, lint, unit/contract tests and builds; start available isolated existing services and UI/API; inspect 11 routes in EN/VI, theme, responsive, retry and failure recovery.

## Per-phase tests and regression strategy

Translation parity/source-key checks; transport error/status and CORS tests; health decoder and dashboard partial-failure tests; actual backend-shaped fixtures for service adapters and mutation requests; query gating/selection tests; existing schema/component tests; Python tests where environment allows. Runtime read-only endpoint probes and browser screenshots distinguish unavailable dependencies from application defects.

## Browser verification strategy

Visit each direct route in EN and VI, wait bounded time, record raw keys, console/network errors, visible states, and screenshot paths. Exercise safe search/tabs/language/retry/theme controls. Use fixture-backed browser requests only for explicitly marked negative/contract tests, never claim these validate real backend connectivity.

## Risk register and remaining blockers

External services may be unavailable. Do not touch unrelated portlink data/services. API Bronze workers are stubs; worker managers have no observed startup; Silver/Gold write paths are unverified. These must not be advertised as successful production execution. Public API hosting URL and Cloudflare account access are not established. No deployment or production data mutations are part of smoke testing.

## Completion checklist and final evidence

- [x] EN/VI resources and regression tests
- [x] Transport/configuration corrections
- [x] Truthful metrics and Health contracts
- [x] Per-screen adapters/actions and UI states
- [x] Schematic/responsive checks
- [x] Automated verification for web/API; Python dependency blocker recorded
- [x] Real browser evidence for 11 screens
- [x] Document unresolved service/execution/deployment blockers

Local web/API recovery is verified within the evidence below. Overall platform status remains PARTIALLY VERIFIED because executors, storage compatibility and Python regression are not end-to-end verified.

## Resume audit — 2026-10-21

The branch remains `fix/data-lake-full-stack-recovery` at revision `3e9cea3`. Runtime processes and temporary browser artifacts from the preceding run are unavailable; recreate evidence inside the workspace. New background/logo asset changes were observed at resume and are outside this task. Preserve them.

A reproducibility defect was confirmed: the committed lockfile has no API importer, specifies React 18 for the web importer while the manifest requires React 19, and installed node modules use Fiber 9/Drei 10 although the manifest specifies Fiber 8/Drei 9. Align React 19 renderer peers, declare the test dependencies actually imported, regenerate the shared lockfile, and verify a frozen install before relying on fresh build/test results. Add a repeatable browser suite and retain evidence under ignored test-results instead of temporary storage.

## Final local verification and handoff

See the [A–J evidence report](../../shared/AUDIT_FULL_STACK_RECOVERY.md) for exact commands, 11-screen EN/VI screenshots and limitations. Final root `pnpm test`: API 62 + web 83 = 145 PASS. Web/API typecheck and builds pass. Frozen install, shell syntax, Compose config and diff whitespace checks pass. Browser full suite 31/31; after correcting camera/fog, Schematic focused retest 3/3 and screenshots were inspected. Read-only API probe 23/23 HTTP 200; all six dependency checks up.

Airflow local now has three paused DAGs and zero runs; crawler DAG import fails because the stock image lacks kafka-python. Python dependency installation failed with DNS/timeout; pytest/ruff unavailable. No real ingestion, transformation, aggregation, crawler, produce, DQ suite or DAG execution was triggered. No production deployment, commit or merge was performed.

Next engineering scope: reproducible executor dependencies, worker startup, aligned API/Python storage contract and an isolated data-backed pipeline test. These are not covered by an HTTP 200 or a rendered frontend.
