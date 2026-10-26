/**
 * The dashboard read model.
 *
 * MASTER PLAN §08 defines the Home KPI contract. This service is the single
 * authority that reconciles every Home card with its source, and it holds
 * two rules that the UI must never re-derive on its own:
 *
 *  1. **A metric is an object, not a number.** Every metric carries its
 *     provenance (`source`), its measurement window (`window`), whether it
 *     is fresh (`status`) and how much of the scope it covers
 *     (`coverage`). An unknown value is `null` — never a guessed `0`.
 *  2. **The counts are not additive.** `Records Processed (all time)` is
 *     the unique committed input record count of the *designated ingestion
 *     stage* (Bronze). Silver and Gold re-process the same rows, so adding
 *     the three layers would count every row three times. The per-stage
 *     numbers are exposed separately and explicitly marked non-additive.
 *
 * Every provider call is isolated with `Promise.allSettled`: a dependency
 * that is down degrades *one* metric to `unavailable` instead of failing
 * the whole dashboard. That is the failure isolation MASTER PLAN §08.1
 * requires.
 */

import { logger } from '@/lib/logger';
import { env } from '@/config';
import {
  AUDIT_EVENT_PREFIX,
  OPERATION_EVENT_PREFIX,
  sourceBoundary,
  type CursorPosition,
} from '@/lib/pagination';
import { OperationRepository } from '@/modules/operations/repositories';
import { AuditService } from '@/modules/security/services';
import { DatabaseService } from '@/modules/catalog/services/database.service';
import { BronzeJobRepository } from '@/modules/bronze/repositories/bronze-job.repository';
import { SilverJobRepository } from '@/modules/silver/repositories/silver-job.repository';
import { GoldJobRepository } from '@/modules/gold/repositories/gold-job.repository';
import { DqSummaryService, type DqSummaryWindow } from '@/modules/dq/services/dq.service';
import { KafkaTopicRepository, KafkaClusterRepository } from '@/modules/kafka/repositories';
import { AirflowClusterRepository } from '@/modules/airflow/repositories/airflow.repository';
import { HealthService } from '@/modules/health/services/health.service';
import { usesDatabricks } from '@/lib/infra/databricks/client';
import type {
  DashboardActivity,
  DashboardActivityEvent,
  DashboardMetric,
  DashboardMetricStatus,
  DashboardPartialFailure,
  DashboardServiceHealth,
  DashboardStageState,
  DashboardSummary,
} from '../types';

const dashboardLogger = logger.child({ module: 'dashboard' });

/**
 * The freshness budget of a *live* measurement.
 *
 * MASTER PLAN §08 requires a stale indicator: a number that is known but
 * too old to represent the present must not be rendered as a fresh
 * reading.
 */
const STALE_AFTER_MS = 60_000;

/**
 * The freshness budget of the **catalog projection**.
 *
 * The local catalog is not a live provider: it is a projection refreshed by
 * the scheduled sync job every five minutes. A reading of it is therefore
 * fresh for as long as that job keeps running — and when the sync job
 * dies, the catalog silently keeps serving the *old* snapshot. That is
 * exactly the failure the stale indicator exists to expose, so the
 * budget is twice the sync interval: past that, the projection is
 * presumed broken rather than merely lagging.
 */
const CATALOG_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const CATALOG_STALE_AFTER_MS = CATALOG_SYNC_INTERVAL_MS * 2;

/**
 * The freshness budget of a **live catalog read**.
 *
 * The Databricks catalog is not a projection: the control plane reads
 * Unity Catalog directly, through a short-lived cache. A successful read
 * is therefore a *current* reading — its freshness is bounded by the
 * provider cache, not by a sync job.
 *
 * The budget is twice the cache window, so a read that took an unusual
 * amount of time is not immediately flagged as stale.
 */
const CATALOG_READ_CACHE_TTL_MS = 60_000;
const CATALOG_READ_STALE_AFTER_MS = CATALOG_READ_CACHE_TTL_MS * 2;

/**
 * The freshness budget of the **all-history quality figure**.
 *
 * A pass rate over every evaluated run is a historical aggregate: it does
 * not decay. But it also stops being *evidence* about the present as soon
 * as the pipeline stops evaluating anything — a "87%" that was last
 * measured three days ago reads as a current health figure when it is
 * really a last-known value.
 */
const QUALITY_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Whether a measurement is too old to be presented as current.
 *
 * The age is measured from the measurement's own instant, not from the
 * moment the response was built — a value that was already old when it
 * was read is stale, and re-stamping it with "now" would hide that.
 */
function isStale(asOf: string, staleAfterMs: number): boolean {
  const measuredAt = Date.parse(asOf);
  if (Number.isNaN(measuredAt)) return false;
  return Date.now() - measuredAt > staleAfterMs;
}

/**
 * The oldest of a set of source timestamps.
 *
 * A projection is only as fresh as its *stalest* part, so the minimum is
 * the honest answer. `null` when there is nothing to compare against.
 */
function oldestTimestamp(values: ReadonlyArray<Date | string | null | undefined>): string | null {
  let oldest: number | null = null;
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
    if (Number.isNaN(parsed)) continue;
    if (oldest === null || parsed < oldest) oldest = parsed;
  }
  return oldest === null ? null : new Date(oldest).toISOString();
}

function metric(
  value: number | null,
  source: string,
  window: string,
  options: {
    status?: DashboardMetricStatus;
    coverage?: number | null;
    reason?: string;
    asOf?: string;
    /** How old the measurement may be before it is reported as stale. */
    staleAfterMs?: number;
  } = {},
): DashboardMetric {
  const asOf = options.asOf ?? nowIso();
  const status: DashboardMetricStatus =
    options.status ??
    (value === null
      ? 'unavailable'
      : isStale(asOf, options.staleAfterMs ?? STALE_AFTER_MS)
        ? 'stale'
        : 'ok');
  return {
    value,
    status,
    source,
    window,
    asOf,
    coverage: options.coverage ?? null,
    ...(options.reason ? { reason: options.reason } : {}),
  };
}

/**
 * The scope the summary was computed for.
 *
 * The scope is part of the response because the same metric name means
 * different things in different scopes: "Total Tables" for the local
 * Delta lakehouse is not the same number as "Total Tables" for Unity
 * Catalog. The UI shows the scope next to the metric.
 */
function resolveScope(): string {
  return env.LAKEHOUSE_DATA_SOURCE === 'databricks'
    ? 'databricks_uc'
    : 'local_delta_minio';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resolve the requested quality window.
 *
 * An unknown window falls back to `all` — every evaluated run. That is the
 * honest default: silently coercing an unknown window to `24h` would
 * report a number measured over a population the caller did not ask for.
 */
function resolveWindow(window?: string): DqSummaryWindow {
  return window === '24h' ? '24h' : 'all';
}

/**
 * The number of accessible, non-system tables.
 *
 * MASTER PLAN §08: "Số bảng dataset accessible (filter catalog/provider,
 * exclude system)". The catalog is provider-scoped — the configured
 * `LAKEHOUSE_DATA_SOURCE` decides which store is read — and system schemas
 * (`information_schema`) are excluded.
 *
 * ## The measurement's instant depends on the provider
 *
 * The two catalogs have genuinely different freshness semantics, and the
 * metric must report the right one for each:
 *
 *  * **Local projection** — the catalog is a MongoDB projection refreshed
 *    by the scheduled sync job. Its instant is the projection's own
 *    last-sync time, not "now". If the sync job dies, the catalog keeps
 *    serving the old snapshot; reporting that stale number as fresh is
 *    exactly the false confidence the metric contract forbids.
 *
 *  * **Databricks (live read)** — the control plane reads Unity Catalog
 *    directly through a short-lived cache. The schema's `updated_at` is
 *    the moment the *schema was last altered in SQL*, not the moment the
 *    control plane read it. A schema that was created weeks ago and
 *    never altered is not a stale *reading* — it is a perfectly current
 *    reading of a schema that simply has not changed.
 *
 *    Using the schema's DDL timestamp as the reading's instant made
 *    "Total Tables" permanently `stale` on every Databricks deployment
 *    whose schemas were not altered recently — a false positive that
 *    told the operator the catalog was broken when it was not.
 */
async function measureTotalTables(): Promise<DashboardMetric> {
  const source = `catalog:${resolveScope()}`;
  const databases = await DatabaseService.list();
  const accessible = databases.filter((database) => database.systemSchema !== true);
  // A database that spans several layers still contributes its tables once —
  // the count is of distinct databases' tables, never a sum over layers.
  const total = accessible.reduce((sum, database) => sum + database.tableCount, 0);

  if (usesDatabricks()) {
    // A live read: the instant is the read itself, and the freshness
    // budget is the provider cache window.
    return metric(total, source, 'all-time', {
      coverage: 1,
      staleAfterMs: CATALOG_READ_STALE_AFTER_MS,
    });
  }

  // The projection is only as fresh as its stalest database.
  const projectedAt = oldestTimestamp(accessible.map((database) => database.updatedAt));
  return metric(total, source, 'all-time', {
    coverage: 1,
    ...(projectedAt !== null
      ? { asOf: projectedAt, staleAfterMs: CATALOG_STALE_AFTER_MS }
      : {}),
  });
}

/**
 * Distinct operations that are *actually running*.
 *
 * MASTER PLAN §08 forbids adding an Airflow DAG run and the BullMQ job
 * behind it. The operation registry is the canonical registry, and each
 * operation is one logical piece of work, so counting the `running`
 * operations is the deduplicated answer by construction.
 */
async function measureRunningJobs(): Promise<DashboardMetric> {
  const result = await OperationRepository.list({ status: 'running', limit: 200, offset: 0 });
  return metric(result.operations.length, 'operations.registry', 'live', {
    coverage: result.total > 200 ? 200 / result.total : 1,
    ...(result.total > 200 ? { reason: 'Truncated to the first 200 running operations.' } : {}),
  });
}

/** Non-internal topics visible in the Kafka cluster. */
async function measureActiveTopics(): Promise<DashboardMetric> {
  const topics = await KafkaTopicRepository.listTopics({ internal: false });
  return metric(topics.length, 'kafka.admin.listTopics', 'live', { coverage: 1 });
}

/** Total consumer lag across the Kafka cluster. */
async function measureTotalLag(): Promise<DashboardMetric> {
  const stats = await KafkaClusterRepository.stats();
  return metric(stats.totalLag, 'kafka.admin.consumerOffsets', 'live', { coverage: 1 });
}

/**
 * Unpaused DAGs.
 *
 * The label is explicit: this is the count of DAGs that are *not paused*,
 * not the count of DAGs that are running right now. The latter is a
 * different KPI (`Running DAG Runs`).
 */
async function measureActiveDags(): Promise<DashboardMetric> {
  const stats = await AirflowClusterRepository.stats();
  return metric(stats.activeDags, 'airflow.dags.activeUnpaused', 'live', { coverage: 1 });
}

/**
 * The unique committed input records of the Bronze ingestion stage.
 *
 * Only *completed* Bronze jobs count — a queued or failed job wrote
 * nothing, and a running job has not committed yet. Each job's
 * `rowCount` is the number of rows that job actually committed, so the sum
 * is the number of distinct source records that entered the lakehouse.
 *
 * The Bronze stage is the **designated ingestion stage**: Silver and Gold
 * re-process rows that were already counted, so they are reported
 * separately under `recordsByStage` and never added here.
 */
async function measureRecordsProcessed(): Promise<{
  recordsProcessed: DashboardMetric;
  recordsByStage: {
    bronze: DashboardMetric;
    silver: DashboardMetric;
    gold: DashboardMetric;
  };
}> {
  const [bronze, silver, gold] = await Promise.all([
    BronzeJobRepository.stats(),
    SilverJobRepository.stats(),
    GoldJobRepository.stats(),
  ]);

  const bronzeRows = bronze.totalRowsIngested;
  const recordsProcessed = metric(bronzeRows, 'bronze.jobs.committed', 'all-time', {
    coverage: 1,
    ...(bronze.total > 0
      ? {}
      : { reason: 'No Bronze ingestion job has committed yet.' }),
  });

  const recordsByStage = {
    bronze: metric(bronzeRows, 'bronze.jobs.committed', 'all-time', { coverage: 1 }),
    silver: metric(silver.totalRowsTransformed, 'silver.jobs.committed', 'all-time', {
      coverage: 1,
      ...(silver.total > 0 ? {} : { reason: 'No Silver transform job has committed yet.' }),
    }),
    gold: metric(gold.totalRowsAggregated, 'gold.jobs.committed', 'all-time', {
      coverage: 1,
      ...(gold.total > 0 ? {} : { reason: 'No Gold aggregate job has committed yet.' }),
    }),
  };

  return { recordsProcessed, recordsByStage };
}

/**
 * The share of evaluated rule checks that passed, in the defined window.
 *
 * The window is either *every evaluated run* or the rolling last 24 hours.
 * `null` means "not evaluated": an empty ledger is `NOT_EVALUATED`, never
 * 100%.
 *
 * The metric always states its own window, so the UI never has to guess
 * which population the percentage was measured over.
 *
 * ## The unit is a percentage, not a fraction
 *
 * `DqSummaryService` computes a *fraction* (`0.87`), but this metric is a
 * **percentage** (`87`). The two must not be mixed: the Home card renders
 * `${value}%` and the Schematic renders `{{rate}}%`, so a fraction would
 * have been displayed as `0.87%` — an 87%-healthy pipeline reading as
 * catastrophically broken. The conversion happens exactly here, at the
 * boundary, so no consumer has to know which unit its source used.
 */
async function measureQualityPassRate(
  window: DqSummaryWindow,
): Promise<DashboardMetric> {
  const summary = await DqSummaryService.summary(window);
  const windowLabel = window === '24h' ? '24h' : 'all-evaluated-runs';
  if (summary.passRate === null) {
    return metric(null, 'dq.runs.passRate', windowLabel, {
      status: 'not_evaluated',
      coverage: summary.coverageRate,
      reason:
        summary.status === 'error'
          ? 'Data-quality runs failed before any data was evaluated. Check the run errors in Data Quality.'
          : 'No data-quality rule has been evaluated yet.',
    });
  }

  // The measurement's instant is the last actual evaluation, not "now".
  // A pass rate that was last measured a week ago is a last-known value,
  // and the contract requires it to say so rather than to look current.
  const lastEvaluatedAt = summary.recentRuns[0]?.finishedAt ?? null;

  return metric(summary.passRate * 100, 'dq.runs.passRate', windowLabel, {
    coverage: summary.coverageRate,
    ...(lastEvaluatedAt !== null
      ? { asOf: lastEvaluatedAt, staleAfterMs: QUALITY_STALE_AFTER_MS }
      : {}),
  });
}

/**
 * The live state of each pipeline stage.
 *
 * The Schematic overlay is a *projection* of the same read model that
 * feeds the Home KPI — it never reads a second source. That is what keeps
 * the schematic and the cards next to it from disagreeing.
 *
 * A stage is a **set of operation kinds**, not a single kind. The catalog
 * and the storage are not written by an operation of their own — they are
 * written *by* the layer operations — so their state is the union of the
 * operations that feed them. Reporting "the catalog has 0 running
 * operations" would be true but useless; reporting the operations that are
 * currently publishing to it is what an operator needs.
 */
const STAGE_MEMBERSHIPS: ReadonlyArray<{ stage: string; kinds: ReadonlyArray<string> }> = [
  { stage: 'crawler', kinds: ['crawler.run'] },
  { stage: 'bronze', kinds: ['bronze.ingest'] },
  { stage: 'silver', kinds: ['silver.transform'] },
  { stage: 'gold', kinds: ['gold.aggregate'] },
  { stage: 'dq', kinds: ['dq.rule_run'] },
  { stage: 'airflow', kinds: ['airflow.dag_trigger'] },
  // The catalog is populated by the layer stages publishing into it.
  { stage: 'catalog', kinds: ['silver.transform', 'gold.aggregate'] },
  // The storage is written by every stage that commits data.
  {
    stage: 'storage',
    kinds: ['bronze.ingest', 'silver.transform', 'gold.aggregate', 'crawler.run'],
  },
];

/** The stages the overlay always renders, in pipeline order. */
const OVERLAY_STAGES = [
  'crawler',
  'bronze',
  'silver',
  'gold',
  'dq',
  'airflow',
  'catalog',
  'storage',
] as const;

async function measureStageStates(
  failures: DashboardPartialFailure[],
  window: DqSummaryWindow,
): Promise<DashboardStageState[]> {
  try {
    // The running operations are read once and shared by every stage — the
    // same rule the record counters follow. Reading them per stage would
    // issue one query per node for the same data.
    const running = await OperationRepository.list({
      status: 'running',
      limit: 200,
      offset: 0,
    });

    // Index the running operations by kind once, so each stage is a lookup
    // rather than another scan.
    const runningByKind = new Map<string, number>();
    for (const operation of running.operations) {
      runningByKind.set(operation.kind, (runningByKind.get(operation.kind) ?? 0) + 1);
    }

    // The **last** operation of each kind is read with one query per kind.
    //
    // It used to be derived from a single global "latest N operations"
    // list, which is wrong: with N=100 and a busy pipeline, the most
    // recent Silver operation could fall outside the window, and the
    // Silver stage would then report *no operation at all* — "idle",
    // as if it had never run. A stage that ran yesterday is not idle.
    //
    // One indexed query per kind is the correct trade: the repository has
    // a `{kind, createdAt}` index, and the number of kinds is fixed and
    // small (six), so the cost is bounded and independent of the traffic.
    const distinctKinds = [
      ...new Set(STAGE_MEMBERSHIPS.flatMap((entry) => entry.kinds)),
    ];

    const lastByKind = new Map<string, (typeof running.operations)[number]>();
    const lastOperations = await Promise.all(
      distinctKinds.map(async (kind) => {
        const result = await OperationRepository.list({
          kind: kind as never,
          limit: 1,
          offset: 0,
        });
        return [kind, result.operations[0]] as const;
      }),
    );
    for (const [kind, operation] of lastOperations) {
      if (operation !== undefined) lastByKind.set(kind, operation);
    }

    // The DQ summary is read with the **same window** the quality metric
    // used. Reading it with the default (`all`) would make the Schematic
    // show an all-time pass rate next to a Home card that shows the 24h
    // one — the exact disagreement the single-read-model rule exists to
    // prevent.
    const quality = await DqSummaryService.summary(window).catch(() => null);

    // The DQ summary has no dedicated `lastRunAt`; the most recent run in
    // its ledger carries the instant. The ledger is newest-first, so the
    // first entry is the latest evaluation.
    const lastQualityRunAt = quality?.recentRuns?.[0]?.finishedAt ?? null;

    return OVERLAY_STAGES.map((stage) => {
      const membership = STAGE_MEMBERSHIPS.find((entry) => entry.stage === stage);

      const stageRunning = membership
        ? membership.kinds.reduce(
            (sum, kind) => sum + (runningByKind.get(kind) ?? 0),
            0,
          )
        : 0;

      // The most recent operation of the stage's kinds.
      const stageOperations = membership
        ? membership.kinds
            .map((kind) => lastByKind.get(kind))
            .filter((operation): operation is NonNullable<typeof operation> =>
              operation !== undefined,
            )
        : [];
      const last = stageOperations.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      )[0];

      return {
        stage,
        running: stageRunning,
        lastOperation: last
          ? {
              id: last.operationId,
              kind: last.kind,
              status: last.status,
              at: last.createdAt,
              ...(last.datasets[0] ? { datasetId: last.datasets[0].datasetId } : {}),
            }
          : null,
        quality: {
          // The quality figure belongs to the DQ stage only. Reporting it
          // on every stage would be a lie — the pass rate is measured
          // across the rule ledger, not per stage.
          //
          // The unit is a **percentage** (0–100), matching
          // `measureQualityPassRate` — see the note there. The Schematic
          // renders `{{rate}}%`, so a fraction would read as `0.87%`.
          //
          // A pass rate of exactly `0` is a *real* measurement (every check
          // failed), so it must survive the conversion — it is not the
          // same as "no measurement".
          passRate:
            stage === 'dq' && quality?.passRate !== null && quality?.passRate !== undefined
              ? quality.passRate * 100
              : null,
          asOf: stage === 'dq' ? lastQualityRunAt : null,
        },
      };
    });
  } catch (error) {
    failures.push({ metric: 'stageStates', reason: errorMessage(error) });
    dashboardLogger.warn(
      { metric: 'stageStates', err: errorMessage(error) },
      'Stage states unavailable',
    );
    return OVERLAY_STAGES.map((stage) => ({
      stage,
      running: 0,
      lastOperation: null,
      quality: { passRate: null, asOf: null },
    }));
  }
}

/** The per-service reachability of the dependencies the dashboard reads. */
async function measureServiceHealth(): Promise<DashboardServiceHealth[]> {
  const asOf = nowIso();
  const probes: Array<{
    name: string;
    run: () => Promise<unknown>;
  }> = [
    {
      name: 'MongoDB',
      run: async () => {
        const { getMongo } = await import('@/lib/infra/mongo');
        const client = await getMongo();
        return { readyState: client.connection.readyState };
      },
    },
    {
      name: 'Kafka',
      run: async () => {
        const admin = await KafkaClientAdmin();
        return { brokers: admin.brokers.length };
      },
    },
    {
      name: 'Airflow',
      run: async () => {
        const { airflowFetch } = await import('@/lib/infra/airflow');
        await airflowFetch('/health');
        return { reachable: true };
      },
    },
    {
      name: 'DuckDB',
      run: async () => {
        const { getDuckDB } = await import('@/lib/infra/duckdb');
        const instance = await getDuckDB();
        const conn = await instance.connect();
        try {
          await conn.run('SELECT 1;');
        } finally {
          conn.closeSync();
        }
        return { selectOk: true };
      },
    },
    {
      name: 'MinIO',
      run: async () => {
        const { getS3 } = await import('@/lib/infra/s3');
        const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
        const s3 = getS3();
        await s3.send(new HeadBucketCommand({ Bucket: env.S3_HEALTH_BUCKET }));
        return { bucket: env.S3_HEALTH_BUCKET };
      },
    },
  ];

  const results = await Promise.all(
    probes.map(async (probe) => {
      const startedAt = Date.now();
      try {
        await probe.run();
        return {
          name: probe.name,
          status: 'up' as const,
          asOf,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        return {
          name: probe.name,
          status: 'down' as const,
          asOf,
          latencyMs: Date.now() - startedAt,
          message: errorMessage(error),
        };
      }
    }),
  );

  // The Databricks dependency only exists when the deployment is configured
  // against Unity Catalog; a local-only deployment must not report it as
  // "down" when it was never asked for.
  if (env.LAKEHOUSE_DATA_SOURCE === 'databricks') {
    const startedAt = Date.now();
    try {
      const { databricksRequest } = await import('@/lib/infra/databricks/client');
      await databricksRequest(
        `/api/2.1/unity-catalog/catalogs/${encodeURIComponent(env.DATABRICKS_CATALOG)}`,
      );
      results.push({
        name: 'Databricks',
        status: 'up',
        asOf,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        name: 'Databricks',
        status: 'down',
        asOf,
        latencyMs: Date.now() - startedAt,
        message: errorMessage(error),
      });
    }
  }

  return results;
}

async function KafkaClientAdmin(): Promise<{ brokers: Array<{ nodeId: number }> }> {
  const { KafkaClient } = await import('@/modules/kafka/repositories/kafka-client');
  const admin = await KafkaClient.admin();
  const cluster = await admin.describeCluster();
  return { brokers: cluster.brokers };
}

/** Wrap a provider call into a settled metric. */
async function settleMetric(
  name: string,
  run: () => Promise<DashboardMetric>,
  failures: DashboardPartialFailure[],
): Promise<DashboardMetric> {
  try {
    return await run();
  } catch (error) {
    const reason = errorMessage(error);
    failures.push({ metric: name, reason });
    dashboardLogger.warn({ metric: name, err: reason }, 'Dashboard metric unavailable');
    return metric(null, name, 'live', { status: 'unavailable', reason });
  }
}

/**
 * Measure the record counters and the per-stage breakdown together.
 *
 * Both come from the same three repository reads, so they are settled as one
 * unit: a failed Bronze counter must not erase the Silver/Gold numbers, and
 * the two views must never disagree about the same underlying read.
 */
async function settleRecords(
  failures: DashboardPartialFailure[],
): Promise<{
  recordsProcessed: DashboardMetric;
  recordsByStage: DashboardSummary['metrics']['recordsByStage'];
}> {
  try {
    return await measureRecordsProcessed();
  } catch (error) {
    const reason = errorMessage(error);
    failures.push({ metric: 'recordsProcessed', reason });
    dashboardLogger.warn({ metric: 'recordsProcessed', err: reason }, 'Dashboard metric unavailable');
    const unavailable = (source: string): DashboardMetric =>
      metric(null, source, 'all-time', { status: 'unavailable', reason });
    return {
      recordsProcessed: unavailable('bronze.jobs.committed'),
      recordsByStage: {
        bronze: unavailable('bronze.jobs.committed'),
        silver: unavailable('silver.jobs.committed'),
        gold: unavailable('gold.jobs.committed'),
      },
    };
  }
}

/**
 * Resolve the overall system status from the probes the dashboard ran.
 *
 * The shallow health check skips every dependency and therefore always
 * answers `ok`. That is the wrong answer for the dashboard: the dashboard
 * *did* probe its dependencies, and a dependency that is down must not be
 * reported as a healthy system.
 *
 * The rule:
 *
 *  * a dependency that is `down` and feeds a **reported metric** makes the
 *    system `down` — the dashboard is missing a number it promises;
 *  * a dependency that is `down` but feeds nothing the summary reports
 *    makes it `degraded` — the system is impaired, but the dashboard is
 *    complete;
 *  * a `degraded` dependency makes it `degraded`;
 *  * otherwise `ok`.
 *
 * The mapping is deliberately the same vocabulary the health endpoint
 * uses (`ok` / `degraded` / `down`), so the two screens cannot disagree.
 */
function resolveSystemStatus(
  serviceHealth: ReadonlyArray<DashboardServiceHealth>,
  failures: ReadonlyArray<DashboardPartialFailure>,
): string {
  const down = serviceHealth.filter((service) => service.status === 'down');
  const degraded = serviceHealth.filter((service) => service.status === 'degraded');

  if (down.length > 0) {
    // A metric that could not be measured means the dashboard is missing a
    // number it promises — that is `down`, not `degraded`.
    const missingMetric = failures.some((failure) =>
      METRIC_PROVIDER_FAILURES.has(failure.metric),
    );
    return missingMetric ? 'down' : 'degraded';
  }
  if (degraded.length > 0) return 'degraded';
  return 'ok';
}

/**
 * The metrics whose failure means the dashboard lost a number.
 *
 * `totalLag` is not in the set: it is not one of the six Home quick
 * stats, so its absence does not make the dashboard incomplete.
 */
const METRIC_PROVIDER_FAILURES = new Set<string>([
  'totalTables',
  'runningJobs',
  'activeTopics',
  'activeDAGs',
  'recordsProcessed',
  'qualityPassRate',
  'stageStates',
]);

export const DashboardService = {
  /**
   * The Home summary.
   *
   * The response is always HTTP 200 with a `partial` flag — a dashboard
   * that fails because one provider is down is less useful than a dashboard
   * that says "Kafka is unavailable" next to the metrics it could read.
   */
  async summary(query: { scope?: string; window?: string } = {}): Promise<DashboardSummary> {
    const startedAt = Date.now();
    const failures: DashboardPartialFailure[] = [];

    // The window is the quality measurement window. It is validated here
    // (not silently coerced) so an unknown window falls back to the honest
    // default: every evaluated run.
    const window = resolveWindow(query.window);

    const [
      totalTables,
      runningJobs,
      activeTopics,
      activeDags,
      records,
      quality,
      totalLag,
    ] = await Promise.all([
      settleMetric('totalTables', measureTotalTables, failures),
      settleMetric('runningJobs', measureRunningJobs, failures),
      settleMetric('activeTopics', measureActiveTopics, failures),
      settleMetric('activeDags', measureActiveDags, failures),
      settleRecords(failures),
      settleMetric('qualityPassRate', () => measureQualityPassRate(window), failures),
      settleMetric('totalLag', measureTotalLag, failures),
    ]);

    const serviceHealth = await measureServiceHealth().catch((error) => {
      failures.push({ metric: 'serviceHealth', reason: errorMessage(error) });
      return [] as DashboardServiceHealth[];
    });

    const stageStates = await measureStageStates(failures, window);

    const overall = await HealthService.check(false).catch(() => null);

    // The overall system status must reflect the dependencies the dashboard
    // actually reads.
    //
    // `HealthService.check(false)` is the *shallow* probe: it skips every
    // dependency and reports `ok` unconditionally. Using it here meant the
    // Home header said "Healthy" while the Kafka card said
    // "Unavailable" — the two statements contradicted each other on the
    // same screen.
    //
    // The service probes the dashboard has just run are the authority for
    // the dashboard's own status. A dependency that is `down` makes the
    // system `degraded`; a dependency that is `down` *and* is one of the
    // metrics the summary reports makes it `down`.
    const systemStatus = resolveSystemStatus(serviceHealth, failures);

    return {
      asOf: nowIso(),
      scope: resolveScope(),
      metrics: {
        totalTables,
        runningJobs,
        activeTopics,
        activeDAGs: activeDags,
        recordsProcessed: records.recordsProcessed,
        recordsByStage: records.recordsByStage,
        qualityPassRate: quality,
        totalLag,
      },
      serviceHealth,
      stageStates,
      partialFailures: failures,
      partial: failures.length > 0,
      freshnessSeconds: Math.round((Date.now() - startedAt) / 1000),
      systemStatus,
      uptimeSeconds: overall?.uptime ?? null,
    };
  },

  /**
   * The activity feed.
   *
   * MASTER PLAN §08.2: the feed is populated from *real* execution events,
   * deduplicated, access-filtered and cursor-paged. An empty feed means
   * "nothing happened yet" — it is never replaced by demo data.
   *
   * The cursor is an opaque, time-ordered key. Because the two sources
   * (operations and the audit ledger) are merged, the cursor encodes both
   * the timestamp and the id of the last item so the next page starts
   * strictly after it.
   */
  async activity(query: {
    limit: number;
    cursor?: string | null;
    kind?: string | null;
    status?: string | null;
    datasetId?: string | null;
  }): Promise<DashboardActivity> {
    const limit = Math.min(Math.max(query.limit, 1), 100);
    const failures: DashboardPartialFailure[] = [];

    // The cursor is decoded *before* the reads so the boundary can be pushed
    // down to the database. Filtering a fixed window in memory would drop
    // every event that happened between the window edge and the cursor.
    const cursor = decodeCursor(query.cursor);

    // Each source gets its own boundary, derived from the shared global
    // order. The cursor may point at an event of the *other* source, in
    // which case the boundary is the timestamp alone — see `sourceBoundary`.
    const operationBoundary = sourceBoundary(cursor, OPERATION_EVENT_PREFIX);
    const auditBoundary = sourceBoundary(cursor, AUDIT_EVENT_PREFIX);

    const [operations, audit] = await Promise.all([
      OperationRepository.list({
        limit: limit * 2,
        offset: 0,
        ...(operationBoundary ? { before: operationBoundary } : {}),
        ...(query.kind ? { kind: query.kind as never } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.datasetId ? { datasetId: query.datasetId } : {}),
      }).catch((error) => {
        failures.push({ metric: 'activity.operations', reason: errorMessage(error) });
        return { operations: [], total: 0 };
      }),
      AuditService.list({
        limit: limit * 2,
        offset: 0,
        ...(auditBoundary ? { before: auditBoundary } : {}),
      }).catch((error) => {
        failures.push({ metric: 'activity.audit', reason: errorMessage(error) });
        return { total: 0, items: [] };
      }),
    ]);

    const operationEvents: DashboardActivityEvent[] = operations.operations.map((operation) => ({
      id: `op:${operation.operationId}`,
      at: operation.createdAt,
      type: 'operation',
      status: operation.status,
      actor: operation.ownerId,
      title: `${operation.kind} — ${operation.datasets.map((d) => d.datasetId).join(', ')}`,
      reference: operation.correlation.jobId ?? operation.operationId,
      link: `/api/operations/${operation.operationId}`,
      ...(operation.datasets[0] ? { datasetId: operation.datasets[0].datasetId } : {}),
    }));

    const auditEvents: DashboardActivityEvent[] = audit.items.map((event) => ({
      id: `audit:${event.eventId}`,
      at: event.createdAt,
      type: 'audit',
      status: event.outcome,
      actor: event.principalId,
      title: `${event.method} ${event.path}`,
      reference: event.action,
      link: event.path,
    }));

    const merged = [...operationEvents, ...auditEvents]
      // Dedupe by id — an operation and an audit event describing the same
      // request must never appear twice.
      .filter((event, index, all) => all.findIndex((other) => other.id === event.id) === index)
      // The global order is `(at DESC, id DESC)`. It must match the keyset
      // order the repositories use exactly, otherwise a page boundary would
      // cut the sequence in a place the database cannot resume from.
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));

    // The boundary was already pushed down to the database, so the in-memory
    // filter is a *safety net*, not the primary mechanism: it removes the
    // events that share the cursor's exact timestamp and sort after the
    // cursor id. Those events are outside the pushed-down boundary when the
    // cursor points into the other source.
    const afterCursor = cursor
      ? merged.filter(
          (event) =>
            event.at < cursor.at || (event.at === cursor.at && event.id < cursor.id),
        )
      : merged;

    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page[page.length - 1];

    return {
      activity: page,
      count: page.length,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ at: last.at, id: last.id }) : null,
      ...(failures.length > 0
        ? {
            partialFailures: failures,
            partial: true,
          }
        : {}),
    };
  },
};

/** The opaque cursor: `{at, id}` encoded as base64url JSON. */
function encodeCursor(value: CursorPosition): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string | null): CursorPosition | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      at?: unknown;
      id?: unknown;
    };
    if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string') return null;
    return { at: parsed.at, id: parsed.id };
  } catch {
    return null;
  }
}
