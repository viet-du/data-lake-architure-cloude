import { useMemo } from 'react';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { QUERY_KEYS } from '../query-keys';
import { dashboardService } from '../dashboard';
import type { EHealthStatus } from '@/types/commons';
import type { DashboardMetric, DashboardSummary } from '@/types/entities';
import type { EDashboardQualityWindow } from '@/store';

/**
 * The Home screen's data source.
 *
 * MASTER PLAN §08: the Home cards are a *read model*, not a client-side
 * aggregation. The previous implementation issued eight parallel requests
 * (catalog + three job-stat endpoints + Kafka + Airflow + DQ + health) and
 * re-derived the semantics in the browser. Two mistakes came out of that:
 *
 *  * `records24h` added Bronze + Silver + Gold together, so every row was
 *    counted three times, and the label said "24h" while the value was
 *    all-time;
 *  * the quality score fell back to a hard-coded `0`, which reads as
 *    "everything failed" when the truth is "nothing was evaluated".
 *
 * Both are now decided by the API, which reports each metric as an object
 * with its provenance, window and freshness. The UI only *renders* it.
 */
export interface HomeAggregatedStats {
  /** The summary the API computed, or `null` while it is loading. */
  summary: DashboardSummary | null;
  /** The scope the metrics belong to (e.g. `local_delta_minio`). */
  scope: string | null;
  totalTables: number | null;
  runningJobs: number | null;
  activeTopics: number | null;
  activeDAGs: number | null;
  /**
   * The unique committed input records of the Bronze ingestion stage.
   *
   * The name says "records" and not "records24h" because the measurement
   * window is *all time* — the label in the UI says so too.
   */
  recordsProcessed: number | null;
  /** The pass rate, or `null` when no rule was evaluated. */
  qualityScore: number | null;
  uptimeSeconds: number | null;
  totalLag: number | null;
  systemStatus: EHealthStatus;
  /** True when at least one metric could not be measured. */
  partial: boolean;
  /** The per-stage record counts — **not additive**. */
  recordsByStage: {
    bronze: number | null;
    silver: number | null;
    gold: number | null;
  };
}

/**
 * The API's system status → the UI's health vocabulary.
 *
 * The API reports `ok` / `degraded` / `down`; the UI uses
 * `healthy` / `degraded` / `unhealthy` / `unknown`. A status the API did
 * * not* report is `unknown`, never `healthy`.
 */
function toHealthStatus(status: string | null): EHealthStatus {
  switch (status) {
    case 'ok':
      return 'healthy';
    case 'degraded':
      return 'degraded';
    case 'down':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

/** The value of a metric, or `null` when it was not measured. */
function metricValue(metric: DashboardMetric | undefined): number | null {
  return metric?.value ?? null;
}

/**
 * Flatten the read model into the Home view-model.
 *
 * This is a pure projection: it never aggregates two sources into one
 * number and never guesses a value. It is exported so the Home view and
 * the tests can use the exact same derivation.
 */
export function toHomeStats(summary: DashboardSummary): HomeAggregatedStats {
  return {
    summary,
    scope: summary.scope,
    totalTables: metricValue(summary.metrics.totalTables),
    runningJobs: metricValue(summary.metrics.runningJobs),
    activeTopics: metricValue(summary.metrics.activeTopics),
    activeDAGs: metricValue(summary.metrics.activeDAGs),
    recordsProcessed: metricValue(summary.metrics.recordsProcessed),
    qualityScore: metricValue(summary.metrics.qualityPassRate),
    totalLag: metricValue(summary.metrics.totalLag),
    uptimeSeconds: summary.uptimeSeconds,
    systemStatus: toHealthStatus(summary.systemStatus),
    partial: summary.partial,
    recordsByStage: {
      bronze: metricValue(summary.metrics.recordsByStage.bronze),
      silver: metricValue(summary.metrics.recordsByStage.silver),
      gold: metricValue(summary.metrics.recordsByStage.gold),
    },
  };
}

/** Fetch the Home read model. */
export async function fetchHomeStats(
  params: { window?: EDashboardQualityWindow } = {},
): Promise<HomeAggregatedStats> {
  const summary = await dashboardService.getSummary(params);
  return toHomeStats(summary);
}

/**
 * The Home screen's query.
 *
 * It registers the **same** query as the Schematic — same key, same
 * query function — and derives the view-model from it.
 *
 * It used to register a *second* query under the *same* key with a
 * different query function that returned a different shape. React Query
 * caches by key, so the two screens fought over one cache entry: the
 * second one to mount read the first one's data and either crashed on the
 * missing fields or rendered `undefined`. Deriving instead of
 * re-registering removes the conflict at its root — there is now exactly
 * one summary in the cache, and every consumer reads it.
 */
export function useHomeStatsQuery(
  params: { window?: EDashboardQualityWindow } = {},
  options?: Omit<UseQueryOptions<HomeAggregatedStats, Error>, 'queryKey' | 'queryFn'>,
) {
  const queryParams = params.window ? { window: params.window } : {};

  const query = useQuery<DashboardSummary, Error>({
    queryKey: QUERY_KEYS.dashboard.summary(queryParams),
    queryFn: () => dashboardService.getSummary(queryParams),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const data = useMemo(
    () => (query.data ? toHomeStats(query.data) : undefined),
    [query.data],
  );

  return {
    ...query,
    data,
    // The caller may still override the fetch behaviour, but it can no
    // longer replace the query function or the key — those are the whole
    // point of this hook.
    ...options,
  };
}
