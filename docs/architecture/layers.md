# Layered Architecture

The codebase enforces a strict layered architecture. Every new feature must respect the layer boundaries.

## apps/web (Frontend)

```
src/
  types/entities/<domain>/*           ← Entity types (no logic, no UI)
  schemas/<domain>/*                  ← Zod validation (parses API payloads)
  services/api/*                      ← HTTP client + endpoint registry
  services/<domain>/*                 ← Domain service (typed wrappers)
  services/queries/*                  ← TanStack Query hooks (data fetching)
  services/query-keys.ts              ← Centralized query keys
  hooks/*                             ← Generic UI hooks (useToast, useFormZod, ...)
  components/                         ← Generic UI (Button, Drawer, Modal, ...)
  components/<domain>/*               ← Domain components (CrawlerJobCard, ...)
  screens/<domain>/*                  ← Page-level views (orchestration only)
  i18n/locales/*                      ← Translation bundles
  theme/*                             ← Tailwind tokens + utilities
```

### Rules

1. **Entity** is plain TypeScript. No fetch, no React.
2. **Schema** owns the parsing logic. Components must never trust raw API payloads.
3. **Service** wraps the API client. Components must never import `apiClient` directly.
4. **Queries** is the only place that calls `useQuery`/`useMutation`. Screens must consume hooks, not services.
5. **Domain components** are pure. They take props, render, and emit callbacks. They never fetch.
6. **Screens** are the only place that owns local state, composes queries, and lays out components.
7. **i18n** is mandatory for every user-visible string.

## apps/api (Backend)

```
src/
  app/api/<domain>/...                ← Next.js Route Handlers (HTTP boundary)
  modules/<domain>/                   ← Domain module (use-cases, ports, adapters)
  modules/shared/                     ← Cross-cutting concerns (logging, errors, ...)
  infra/                              ← External integrations (MinIO, Kafka, Spark, ...)
```

### Rules

1. Route Handlers validate input (Zod), call a use-case, and serialize output (Zod).
2. Use-cases depend on ports (interfaces), not on infra (implementations).
3. Adapters implement ports and live in `infra/`. They are the only place that touches external SDKs.
4. Domain types are defined once and shared via `types/`.

## lakehouse (Python)

```
src/lakehouse/
  batch/                              ← Bronze/Silver/Gold batch jobs
  streaming/                          ← Spark Structured Streaming jobs
  crawlers/                           ← Web crawlers (Tiki, GitHub, Crypto, Weather, ...)
  dq/                                 ← Data quality rules + checks
  common/                             ← Spark session, S3 helpers, configs
  schemas/                            ← Pydantic models
```

### Rules

1. All jobs read/write through Delta Lake on MinIO.
2. Crawlers emit Kafka events, never write directly to bronze.
3. DQ checks are pure functions of a DataFrame plus a rule spec.
4. Configuration via environment variables (see `docs/operations/environment.md`).
