# ============================================================================
# The runtime image is `node:20-bookworm-slim` (glibc), NOT `node:20-alpine`.
#
# Why: `src/lib/infra/duckdb/client.ts` loads the DuckDB `httpfs` and `delta`
# extensions with `INSTALL …; LOAD …;`. DuckDB downloads the extension
# binary that matches the *platform* it detects. On Alpine the platform is
# `linux_arm64_musl`, and the DuckDB extension repository publishes **no
# build** for that platform:
#
#     $ GET https://extensions.duckdb.org/v1.5.6/linux_arm64_musl/delta.duckdb_extension.gz
#     404 Not Found
#     $ GET https://extensions.duckdb.org/v1.5.6/linux_arm64/delta.duckdb_extension.gz
#     200 OK
#
# So on Alpine the API cannot start DuckDB at all and every query that
# touches the lake fails with
#
#     Failed to download extension "delta" … (HTTP 404)
#
# A glibc base reports the platform as `linux_arm64`, for which the
# extension exists. The worker image (`apps/api/Dockerfile.worker`) already
# builds on the Debian base of `lake-airflow:2.7.0` for the same reason.
# ============================================================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---------------------------------------------------------------------------
# Build-time configuration placeholders.
#
# `src/config/env.ts` validates `process.env` at *module load*, and Next.js
# loads every route module while it "collects page data" at the end of
# `next build`. A build therefore fails with
#
#     Error: Invalid environment variables:
#       - KAFKA_BOOTSTRAP: Required
#
# unless the build itself can see a valid environment.
#
# The local build gets one from `apps/api/.env.local`, but that file is
# (correctly) excluded from the Docker build context by `.dockerignore`,
# because it holds real credentials. The build stage therefore supplies
# *placeholders* for every variable the schema requires:
#
#   - `KAFKA_BOOTSTRAP`  — the only field with no default;
#   - `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — the
#     object store, which the schema accepts either as `S3_*` or as its
#     `MINIO_*` compatibility pair.
#
# These values are ONLY used while compiling. They are never baked into the
# image and never reach the running container: the `runner` stage starts
# with a clean environment, and Compose injects the real service endpoints
# (`kafka:29092`, `mongo:27017`, `minio:9000`, …) at run time.
# ---------------------------------------------------------------------------
ENV KAFKA_BOOTSTRAP=build-time-placeholder:9092 \
    MINIO_ENDPOINT=build-time-placeholder:9000 \
    MINIO_ACCESS_KEY=build-time-placeholder \
    MINIO_SECRET_KEY=build-time-placeholder \
    NEXT_BUILD_CPUS=2

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

# The build stage's placeholder `KAFKA_BOOTSTRAP` must NOT leak into the
# runtime image: Compose injects the real broker address. Declaring the key
# here with an empty value would override the Compose value, so the key is
# simply left unset and the container starts with only the real values.

# `addgroup --system` / `adduser --system` are BusyBox (Alpine) syntax. On
# the Debian base the equivalents are `groupadd --system` and
# `useradd --system`.
#
# `ca-certificates` is mandatory on this base: `node:20-bookworm-slim` ships
# NO certificate bundle at all (`/etc/ssl/certs` does not exist), so every
# HTTPS call fails. That breaks two things at once:
#
#   * DuckDB's `INSTALL delta` — it downloads the extension over HTTPS and
#     reports "ERROR Problem with the SSL CA cert (path? access rights?)";
#   * the Databricks client — `DATABRICKS_HOST` is an HTTPS workspace.
RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid 1001 --no-create-home --shell /usr/sbin/nologin nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
# The destination is `./package.json`, NOT `./app/package.json`: the working
# directory is already `/app`, so an `app/` prefix would nest the file at
# `/app/app/package.json` and `npm start` would abort with
# "Could not read package.json: ENOENT … /app/package.json".
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# The canonical environment loader must travel with `next.config.ts`: the
# runtime image has no `src/` directory, and `next.config.ts` `require()`s
# this file to resolve the environment before any route handler starts.
COPY --from=builder /app/env-loader.js ./env-loader.js
COPY --from=builder /app/src/modules/gold-queries/sql ./src/modules/gold-queries/sql

USER nextjs
EXPOSE 3001
# The health check uses Node itself: `node:20-bookworm-slim` ships neither
# `wget` nor `curl`, so a shell-based probe would always fail and report
# the container as unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
