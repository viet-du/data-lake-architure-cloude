/**
 * The EDA / profiling vocabulary.
 *
 * MASTER PLAN §07.2 defines the canonical `DatasetProfile` schema. The
 * rules encoded here are the ones the master plan states as non-negotiable:
 *
 *  * counts are **strings** — a row count can exceed `Number.MAX_SAFE_INTEGER`
 *    and a float would silently lose precision;
 *  * `passRate`-style aggregates are `null` when nothing was measured —
 *    never `0` and never `1`;
 *  * a profile always carries its **provenance**: engine, version, query
 *    hash, sample policy and whether the result is approximate;
 *  * a missing value is never conflated with `0` — `nullCount` and
 *    `nonNullCount` are separate, and `fieldMissingCounts` mirrors that.
 */

/** The profiling lifecycle of a profile run. */
export const PROFILE_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'partial',
  'failed',
] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/** The logical type a column was classified as. */
export const LOGICAL_TYPES = [
  'numeric',
  'categorical',
  'boolean',
  'datetime',
  'text',
  'complex',
] as const;
export type LogicalType = (typeof LOGICAL_TYPES)[number];

/** The severity of a profiling alert. */
export const ALERT_SEVERITIES = ['info', 'warn', 'error'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** The profiling analyses that can be requested. */
export const PROFILE_ANALYSES = [
  'structure',
  'univariate',
  'categorical',
  'correlation',
  'temporal',
] as const;
export type ProfileAnalysis = (typeof PROFILE_ANALYSES)[number];

/** The sampling policies the engine understands. */
export const SAMPLE_POLICIES = ['full', 'sample', 'stratified'] as const;
export type SamplePolicy = (typeof SAMPLE_POLICIES)[number];

/** The chart identifiers a profile can serve. */
export const CHART_TYPES = [
  'missing',
  'histogram',
  'box',
  'categorical',
  'temporal',
  'correlation',
  'scatter',
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** The dataset a profile describes. */
export interface ProfileDatasetRef {
  /** Canonical dataset id: `provider/layer.database.table`. */
  datasetId: string;
  /** The provider that owns the data. */
  provider: string;
  /** The medallion layer, when the dataset has one. */
  layer?: string;
  /** The Delta snapshot version that was profiled. */
  version?: number;
  /** The fully-qualified name in the owning catalog. */
  qualifiedName?: string;
}

/** What the request asked the engine to compute. */
export interface ProfileConfig {
  /** The columns the profile is restricted to. Empty means "all". */
  columns: string[];
  /** The analyses that were requested. */
  analyses: ProfileAnalysis[];
  /** Whether a correlation matrix was requested. */
  includeCorrelation: boolean;
  /** The sampling policy. */
  sampleStrategy: SamplePolicy;
  /** The requested sample size. */
  sampleSize?: number;
  /** The reproducible sampling seed. */
  seed?: number;
  /** Row filters (always expressed as a safe, allow-listed form). */
  filters?: Record<string, unknown>;
}

/** What was actually observed. */
export interface ProfilePopulation {
  /** The total row count of the source snapshot. */
  rowCount: string | null;
  /** True when the row count is an estimate rather than an exact count. */
  estimate: boolean;
  /** The number of columns profiled. */
  columnCount: number;
  /** The bytes the engine read, when it could report it. */
  bytesScanned?: string;
}

/** How much of the population the profile actually covered. */
export interface ProfileCoverage {
  /** The number of rows the statistics were computed over. */
  rowsObserved: string;
  /** `rowsObserved / rowCount`, when both are known. */
  ratio?: number;
  /** The per-column missing counts, mirroring the column profiles. */
  fieldMissingCounts?: Record<string, string>;
}

/** A histogram bucket. */
export interface HistogramBucket {
  lower: number;
  upper: number;
  count: string;
}

/** One categorical value with its count. */
export interface TopValue {
  value: string;
  count: string;
}

/** The profile of one column. */
export interface ColumnProfile {
  name: string;
  logicalType: LogicalType;
  /** The physical type reported by the engine. */
  physicalType?: string;
  /** The number of non-null values. */
  nonNullCount: string;
  /** The number of null values. */
  nullCount: string;
  /** The number of distinct values, when it was computed exactly. */
  distinctCount?: string;
  /** True when the distinct count is an approximation. */
  distinctApprox?: boolean;
  min?: string | number | null;
  max?: string | number | null;
  mean?: number | null;
  std?: number | null;
  p25?: number | null;
  median?: number | null;
  p75?: number | null;
  /** The interquartile range — `p75 - p25`. */
  iqr?: number | null;
  skewness?: number | null;
  kurtosis?: number | null;
  histogram?: HistogramBucket[];
  topValues?: TopValue[];
  /** The number of distinct values beyond which the column is "high cardinality". */
  cardinalityRatio?: number | null;
}

/** The pairwise correlation of a set of columns. */
export interface CorrelationResult {
  method: 'pearson' | 'spearman';
  /** The columns the matrix is indexed by, in order. */
  columns: string[];
  /** The matrix — `null` where the correlation is undefined. */
  matrix: Array<Array<number | null>>;
}

/** A finding the profiler raised about the dataset. */
export interface ProfileAlert {
  kind: string;
  severity: AlertSeverity;
  description: string;
  /** The columns the alert refers to. */
  columns?: string[];
}

/** Where a profile came from and how it was computed. */
export interface ProfileProvenance {
  /** The engine that produced the profile. */
  engine: string;
  /** The engine version. */
  engineVersion?: string;
  /** A hash of the query that was executed — proves reproducibility. */
  queryHash?: string;
  /** When the profile was computed. */
  computedAt?: string;
  /** How long the engine took. */
  elapsedMs?: number;
  /** The sampling policy that was applied. */
  samplePolicy: SamplePolicy;
  /** True when the numbers are estimates. */
  approximate: boolean;
}

/**
 * The canonical dataset profile.
 *
 * MASTER PLAN §07.2. The shape is versioned by `schemaVersion` so a stored
 * profile stays readable after the contract evolves.
 */
export interface DatasetProfile {
  profileId: string;
  /** The operation that produced the profile, when it ran through one. */
  operationId?: string;
  dataset: ProfileDatasetRef;
  configured: ProfileConfig;
  population: ProfilePopulation;
  coverage: ProfileCoverage;
  columns: ColumnProfile[];
  relationships?: CorrelationResult;
  alerts: ProfileAlert[];
  status: ProfileStatus;
  provenance: ProfileProvenance;
  /** The contract version of this document. */
  schemaVersion: number;
  /** The fingerprint of dataset + version + config — proves reproducibility. */
  fingerprint: string;
  createdAt: string;
  /** The sanitised failure message, when the profile failed. */
  errorMessage?: string;
}

/** A bounded, typed chart aggregate. */
export interface ProfileChart {
  chartId: string;
  type: ChartType;
  title: string;
  /** The column the chart describes, when it is column-scoped. */
  column?: string;
  /** The x-axis series. */
  categories?: Array<string | number>;
  /**
   * The y-axis series.
   *
   * `null` is a legitimate value: a correlation pair that could not be
   * computed (a constant column) is `null`, not `0`.
   */
  values?: Array<number | string | null>;
  /** A second y-axis series (for box plots). */
  secondaryValues?: Array<number | string | null>;
  /** Free-form, chart-specific metadata. */
  meta?: Record<string, unknown>;
}

/** A paged list of profiles. */
export interface ProfileListResult {
  profiles: Array<{
    profileId: string;
    datasetId: string;
    status: ProfileStatus;
    createdAt: string;
    computedAt?: string;
    rowCount: string | null;
    columnCount: number;
    alerts: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}
