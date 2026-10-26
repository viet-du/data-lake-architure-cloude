/**
 * The Home dashboard read model (frontend view).
 *
 * The API is the authority for every number on the Home screen. The types
 * below mirror the API contract exactly so the UI never has to guess:
 *
 *  * a metric is an **object**, not a bare number — it carries its
 *    provenance, its window and whether it is fresh;
 *  * an unknown value is `null`, never a guessed `0`;
 *  * the per-stage record counts are **not additive**.
 */

/**
 * The freshness of a measurement.
 *
 * `not_evaluated` is distinct from `unavailable`: a metric that has never
 * been evaluated has no evidence, while an unavailable metric had its
 * source fail. Both render as "unknown", but only `unavailable` is a
 * degraded system.
 */
export type EDashboardMetricStatus =
  | 'ok'
  | 'stale'
  | 'unavailable'
  | 'not_evaluated';

export interface DashboardMetric {
  /** The measured value, or `null` when it is genuinely unknown. */
  value: number | null;
  status: EDashboardMetricStatus;
  /** The authority the value comes from. */
  source: string;
  /** The measurement window (`all-time`, `24h`, `live`, …). */
  window: string;
  /** ISO timestamp of the measurement. */
  asOf: string;
  /** How much of the scope the metric covers (0–1). */
  coverage: number | null;
  /** A human-readable explanation for a degraded/unavailable metric. */
  reason?: string;
}

export interface DashboardServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'skipped' | 'unknown';
  asOf: string;
  latencyMs?: number;
  message?: string;
}

export interface DashboardPartialFailure {
  metric: string;
  reason: string;
}

/**
 * The live state of one pipeline stage.
 *
 * The Schematic overlay renders one of these per node. The numbers are the
 * *same* numbers the Home KPI shows — they come from the same read model,
 * so the schematic can never disagree with the cards next to it.
 */
export interface DashboardStageState {
  /** The stage identifier (`bronze`, `silver`, `gold`, …). */
  stage: string;
  /** The operations of this stage that are currently running. */
  running: number;
  /** The most recent operation of this stage, when there is one. */
  lastOperation: {
    id: string;
    kind: string;
    status: string;
    at: string;
    datasetId?: string | undefined;
  } | null;
  /** The quality outcome of the stage, when it was evaluated. */
  quality: {
    /** `null` when no rule of this stage was ever evaluated. */
    passRate: number | null;
    /** The last evaluation instant. */
    asOf: string | null;
  };
}

export interface DashboardSummary {
  asOf: string;
  /** The scope the summary was computed for (e.g. `local_delta_minio`). */
  scope: string;
  metrics: {
    totalTables: DashboardMetric;
    runningJobs: DashboardMetric;
    activeTopics: DashboardMetric;
    activeDAGs: DashboardMetric;
    /** Unique committed input records of the Bronze ingestion stage. */
    recordsProcessed: DashboardMetric;
    /** The per-stage record counts — **not additive**. */
    recordsByStage: {
      bronze: DashboardMetric;
      silver: DashboardMetric;
      gold: DashboardMetric;
    };
    qualityPassRate: DashboardMetric;
    totalLag: DashboardMetric;
  };
  serviceHealth: ReadonlyArray<DashboardServiceHealth>;
  /**
   * The live state of each pipeline stage.
   *
   * The Schematic overlay renders these directly. They are part of the
   * summary — not a separate request — so the schematic and the Home cards
   * are guaranteed to show the same numbers from the same read model.
   */
  stageStates: ReadonlyArray<DashboardStageState>;
  partialFailures: ReadonlyArray<DashboardPartialFailure>;
  /** True when at least one metric could not be measured. */
  partial: boolean;
  /** How long the summary took to compute. */
  freshnessSeconds: number;
  /** The overall system status, or `null` when the probe failed. */
  systemStatus: string | null;
  /** The API uptime in seconds. */
  uptimeSeconds: number | null;
}

/** The kind of an activity event. */
export type EDashboardActivityType = 'operation' | 'audit';

export interface DashboardActivityEvent {
  id: string;
  at: string;
  type: EDashboardActivityType;
  status: string;
  actor: string;
  title: string;
  reference: string;
  /** The API path the event links to. */
  link: string;
  datasetId?: string | undefined;
}

export interface DashboardActivity {
  activity: ReadonlyArray<DashboardActivityEvent>;
  count: number;
  hasMore: boolean;
  /** The cursor to pass to the next page. */
  nextCursor: string | null;
  partialFailures?: ReadonlyArray<DashboardPartialFailure>;
  partial?: boolean;
}

export interface DashboardDependencies {
  asOf: string;
  scope: string;
  services: ReadonlyArray<DashboardServiceHealth>;
  partial: boolean;
}
