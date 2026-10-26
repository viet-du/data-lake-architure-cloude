/**
 * The Home dashboard read model.
 *
 * MASTER PLAN §08 defines the KPI contract. Every metric is a *metric
 * object* with a provenance, never a bare number:
 *
 * ```json
 * { "value": 42, "status": "ok", "source": "bronze.jobs", "window": "all-time" }
 * ```
 *
 * The rules the contract makes non-negotiable:
 *
 *  * `value` is `null` when the metric is unknown — never a guessed 0.
 *  * A stale-but-last-known value carries `status: "stale"` and its
 *    timestamp, never a fresh-looking number.
 *  * `Records Processed (all time)` sums the **unique committed input
 *    records** of the designated ingestion stage only. Bronze + Silver +
 *    Gold are never added together — the same row would be counted three
 *    times. The per-stage numbers are exposed separately and explicitly
 *    labelled as non-additive.
 *  * `Running Jobs` counts **distinct active operations** in the `running`
 *    state. An Airflow DAG run and the BullMQ job behind it are the same
 *    logical work, so the operation registry is the single authority.
 *  * `Quality Pass Rate` is `null` until at least one rule was evaluated.
 */

export type DashboardMetricStatus = 'ok' | 'stale' | 'unavailable' | 'not_evaluated';

export interface DashboardMetric {
  /** The measured value, or `null` when it is genuinely unknown. */
  value: number | null;
  /** The state of the measurement itself. */
  status: DashboardMetricStatus;
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

/** A provider/service health entry. */
export interface DashboardServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded' | 'skipped' | 'unknown';
  /** ISO timestamp of the probe. */
  asOf: string;
  latencyMs?: number;
  message?: string;
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
    datasetId?: string;
  } | null;
  /** The quality outcome of the stage, when it was evaluated. */
  quality: {
    /** `null` when no rule of this stage was ever evaluated. */
    passRate: number | null;
    /** The last evaluation instant. */
    asOf: string | null;
  };
}

/** A failure that did not make the whole request fail. */
export interface DashboardPartialFailure {
  metric: string;
  reason: string;
}

export interface DashboardSummary {
  asOf: string;
  /** The scope the summary was computed for. */
  scope: string;
  metrics: {
    /** The number of accessible, non-system tables. */
    totalTables: DashboardMetric;
    /** Distinct operations currently in the `running` state. */
    runningJobs: DashboardMetric;
    /** Non-internal topics visible in the Kafka cluster. */
    activeTopics: DashboardMetric;
    /** Unpaused DAGs. */
    activeDAGs: DashboardMetric;
    /** Unique committed input records of the Bronze ingestion stage. */
    recordsProcessed: DashboardMetric;
    /** The per-stage record counts — **not additive**. */
    recordsByStage: {
      bronze: DashboardMetric;
      silver: DashboardMetric;
      gold: DashboardMetric;
    };
    /** The share of evaluated rule checks that passed. */
    qualityPassRate: DashboardMetric;
    /** The total consumer lag across the Kafka cluster. */
    totalLag: DashboardMetric;
  };
  serviceHealth: DashboardServiceHealth[];
  /**
   * The live state of each pipeline stage.
   *
   * The Schematic overlay renders these directly. They are part of the
   * summary — not a separate request — so the schematic and the Home cards
   * are guaranteed to show the same numbers from the same read model.
   */
  stageStates: DashboardStageState[];
  /** The failures that degraded the response. */
  partialFailures: DashboardPartialFailure[];
  /** True when at least one metric could not be measured. */
  partial: boolean;
  /** How long the summary took to compute. */
  freshnessSeconds: number;
  /**
   * The overall system status, taken from the health service.
   *
   * `null` when the health probe itself failed — the dashboard never
   * substitutes a healthy-looking status for a probe that did not answer.
   */
  systemStatus: string | null;
  /** The API uptime in seconds, when the health service reported it. */
  uptimeSeconds: number | null;
}

/** One activity event. */
export interface DashboardActivityEvent {
  id: string;
  at: string;
  type: 'operation' | 'audit';
  status: string;
  actor: string;
  title: string;
  reference: string;
  link: string;
  /** The dataset the event refers to, when it has one. */
  datasetId?: string;
}

export interface DashboardActivity {
  activity: DashboardActivityEvent[];
  count: number;
  /** True when more events exist beyond the returned page. */
  hasMore: boolean;
  /** The cursor to pass to the next page, when there is one. */
  nextCursor: string | null;
  /** The sources that could not be read, when the feed is partial. */
  partialFailures?: DashboardPartialFailure[];
  /** True when at least one source could not be read. */
  partial?: boolean;
}
