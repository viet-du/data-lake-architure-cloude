/**
 * The EDA / profiling vocabulary on the client.
 *
 * The shapes mirror `apps/api/src/modules/eda/types/profile.types.ts` exactly.
 * Two rules from the master plan are load-bearing here:
 *
 *  * counts are **strings** — a row count can exceed
 *    `Number.MAX_SAFE_INTEGER`, so a float would silently lose precision.
 *    The client therefore never parses a count into a `number`;
 *  * a missing measurement is `undefined`, never `0` — a profile that
 *    measured nothing must not render as "no missing values".
 */

/** The profiling lifecycle of a profile run. */
export type EProfileStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';

/** The logical type a column was classified as. */
export type ELogicalType = 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text' | 'complex';

/** The severity of a profiling alert. */
export type EAlertSeverity = 'info' | 'warn' | 'error';

/** The profiling analyses that can be requested. */
export type EProfileAnalysis =
  | 'structure'
  | 'univariate'
  | 'categorical'
  | 'correlation'
  | 'temporal';

/** The sampling policies the engine understands. */
export type ESamplePolicy = 'full' | 'sample' | 'stratified';

/** The chart identifiers a profile can serve. */
export type EChartType =
  | 'missing'
  | 'histogram'
  | 'box'
  | 'categorical'
  | 'temporal'
  | 'correlation'
  | 'scatter';

/** The provider that owns the profiled data. */
export type EProfileProvider = 'local_delta_minio' | 'databricks_uc';

/** The medallion layer of the profiled dataset. */
export type EProfileLayer = 'bronze' | 'silver' | 'gold';

/** The dataset a profile describes. */
export interface EProfileDatasetRef {
  /** Canonical dataset id: `provider/layer.database.table`. */
  datasetId: string;
  provider: EProfileProvider;
  layer?: EProfileLayer;
  /** The Delta snapshot version that was profiled. */
  version?: number;
  qualifiedName?: string;
}

/** What the request asked the engine to compute. */
export interface EProfileConfig {
  columns: ReadonlyArray<string>;
  analyses: ReadonlyArray<EProfileAnalysis>;
  includeCorrelation: boolean;
  sampleStrategy: ESamplePolicy;
  sampleSize?: number;
  seed?: number;
}

/** What was actually observed. */
export interface EProfilePopulation {
  /** The total row count of the source snapshot — a string by contract. */
  rowCount: string | null;
  /** True when the row count is an estimate rather than an exact count. */
  estimate: boolean;
  columnCount: number;
  bytesScanned?: string;
}

/** How much of the population the profile actually covered. */
export interface EProfileCoverage {
  /** The number of rows the statistics were computed over. */
  rowsObserved: string;
  /** `rowsObserved / rowCount`, when both are known. */
  ratio?: number;
}

/** A histogram bucket. */
export interface EHistogramBucket {
  lower: number;
  upper: number;
  /** The bucket population — a string by contract. */
  count: string;
}

/** One categorical value with its count. */
export interface ETopValue {
  value: string;
  count: string;
}

/** The profile of one column. */
export interface EColumnProfile {
  name: string;
  logicalType: ELogicalType;
  physicalType?: string;
  /** The number of non-null values — a string by contract. */
  nonNullCount: string;
  /** The number of null values — a string by contract. */
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
  histogram?: ReadonlyArray<EHistogramBucket>;
  topValues?: ReadonlyArray<ETopValue>;
  /** The distinct-count ratio — `null` when the distinct count is unknown. */
  cardinalityRatio?: number | null;
}

/** The pairwise correlation of a set of columns. */
export interface ECorrelationResult {
  method: 'pearson' | 'spearman';
  /** The columns the matrix is indexed by, in order. */
  columns: ReadonlyArray<string>;
  /** The matrix — `null` where the correlation is undefined. */
  matrix: ReadonlyArray<ReadonlyArray<number | null>>;
}

/** A finding the profiler raised about the dataset. */
export interface EProfileAlert {
  kind: string;
  severity: EAlertSeverity;
  description: string;
  columns?: ReadonlyArray<string>;
}

/** Where a profile came from and how it was computed. */
export interface EProfileProvenance {
  engine: string;
  engineVersion?: string;
  /** A hash of the query that was executed — proves reproducibility. */
  queryHash?: string;
  computedAt?: string;
  elapsedMs?: number;
  samplePolicy: ESamplePolicy;
  /** True when the numbers are estimates. */
  approximate: boolean;
}

/** The canonical dataset profile. */
export interface EDatasetProfile {
  profileId: string;
  operationId?: string;
  dataset: EProfileDatasetRef;
  configured: EProfileConfig;
  population: EProfilePopulation;
  coverage: EProfileCoverage;
  columns: ReadonlyArray<EColumnProfile>;
  relationships?: ECorrelationResult;
  alerts: ReadonlyArray<EProfileAlert>;
  status: EProfileStatus;
  provenance: EProfileProvenance;
  /** The contract version of this document. */
  schemaVersion: number;
  /** The fingerprint of dataset + version + config — proves reproducibility. */
  fingerprint: string;
  createdAt: string;
  /** The sanitised failure message, when the profile failed. */
  errorMessage?: string;
}

/** A bounded, typed chart aggregate. */
export interface EProfileChart {
  chartId: string;
  type: EChartType;
  title: string;
  /** The column the chart describes, when it is column-scoped. */
  column?: string;
  /** The x-axis series. */
  categories?: ReadonlyArray<string | number>;
  /**
   * The y-axis series.
   *
   * `null` is a legitimate value: a correlation pair that could not be
   * computed (a constant column) is `null`, not `0`.
   */
  values?: ReadonlyArray<number | string | null>;
  /** A second y-axis series (for box plots). */
  secondaryValues?: ReadonlyArray<number | string | null>;
  /** Free-form, chart-specific metadata. */
  meta?: Record<string, unknown>;
}

/** A paged list of profiles. */
export interface EProfileListResult {
  profiles: ReadonlyArray<{
    profileId: string;
    datasetId: string;
    status: EProfileStatus;
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

/** The response of a profile request (HTTP 202). */
export interface EProfileAccepted {
  profileId: string;
  status: EProfileStatus;
  fingerprint: string;
  datasetId: string;
  links?: { self?: string };
}

/** A bounded sample of the profiled dataset. */
export interface EProfileSample {
  profileId: string;
  datasetId: string;
  limit: number;
  rows: ReadonlyArray<Record<string, unknown>>;
}

/** One column of a profile comparison. */
export interface EProfileComparisonColumn {
  name: string;
  baselineNullRate: number | null;
  candidateNullRate: number | null;
  nullRateDelta: number | null;
  baselineMean: number | null;
  candidateMean: number | null;
  meanDelta: number | null;
  /** Cohen's d — the effect size of the mean change. */
  effectSize: number | null;
  /** The two-proportion z-score of the null-rate change. */
  zScore: number | null;
  /** Whether the change exceeds the disclosed threshold. */
  significant: boolean;
}

/** The comparison of two verified profiles. */
export interface EProfileComparison {
  comparisonId: string;
  baseline: { profileId: string; computedAt?: string; fingerprint: string };
  candidate: { profileId: string; computedAt?: string; fingerprint: string };
  /** False when the two profiles cannot be compared (see `reasons`). */
  comparable: boolean;
  reasons: ReadonlyArray<string>;
  columns: ReadonlyArray<EProfileComparisonColumn>;
}

/** The rule the EDA → DQ bridge proposed (created as a draft). */
export interface EProposedRule {
  ruleId: string;
  name: string;
  type: string;
  layer: string;
  table: string;
  column: string;
  params: Record<string, unknown>;
  enabled: boolean;
  severity: string;
  suggestedThreshold: number | null;
  created: boolean;
}

/** The dataset selector accepted by the profile request. */
export interface EProfileDatasetInput {
  datasetId?: string;
  provider?: EProfileProvider;
  layer?: EProfileLayer;
  database?: string;
  table?: string;
}

/** The body of a profile request. */
export interface ECreateProfilePayload {
  dataset: EProfileDatasetInput;
  version?: number;
  columns: ReadonlyArray<string>;
  analyses: ReadonlyArray<EProfileAnalysis>;
  includeCorrelation: boolean;
  samplePolicy: ESamplePolicy;
  sampleSize?: number;
  seed?: number;
  filters?: Record<string, ReadonlyArray<string | number | boolean>>;
}

/** The body of the EDA → DQ bridge request. */
export interface EProposeRulePayload {
  profileId: string;
  column: string;
  type: 'null_check' | 'range_check' | 'in_set' | 'unique' | 'regex';
  threshold?: number;
  name?: string;
  enabled?: boolean;
}

/** The body of a profile comparison request. */
export interface ECompareProfilesPayload {
  profileId: string;
  baselineProfileId: string;
}
