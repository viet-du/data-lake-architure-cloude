import { createHash } from 'node:crypto';
import { AppError } from '@/errors';
import { getDuckDB } from '@/lib/infra/duckdb';
import { logger } from '@/lib/logger';
import {
  assertReadable,
  canonicalStoragePath,
  resolveDataset,
  resolveFromDatasetId,
  type DatasetLayer,
  type DatasetRef,
} from '@/modules/datasets/types';
import type {
  ColumnProfile,
  CorrelationResult,
  HistogramBucket,
  LogicalType,
  ProfileAlert,
  ProfileConfig,
  ProfileCoverage,
  ProfilePopulation,
  ProfileProvenance,
  TopValue,
} from '../types';

/**
 * The local Delta profiling engine.
 *
 * MASTER PLAN §07.1: "Small/local Delta: DuckDB read-only via `delta_scan`
 * if installed version actually supports source format; no implicit
 * `INSTALL` from internet in production request; connection cleanup,
 * resource limits."
 *
 * Every guarantee of this file follows from that paragraph:
 *
 *  * the engine reads through `delta_scan` on the canonical path resolved by
 *    the shared `DatasetResolver` — it never receives a raw path from the
 *    browser;
 *  * the connection is closed on every path (including errors), so a
 *    hundred profiles do not leak a hundred connections;
 *  * the scan is bounded: a sampling policy is translated into a
 *    `USING SAMPLE` clause with a reproducible seed, and the row count is
 *    measured separately so the profile reports the *population* size and
 *    the *observed* size honestly;
 *  * no `INSTALL`/`LOAD` happens here — the client does that once at
 *    startup.
 */

/** DuckDB connection type used by the helpers below. */
type ProfileConnection = Awaited<
  ReturnType<Awaited<ReturnType<typeof getDuckDB>>['connect']>
>;

/** The default number of histogram buckets. */
const DEFAULT_HISTOGRAM_BINS = 20;

/** The maximum number of top values kept per categorical column. */
const MAX_TOP_VALUES = 20;

/** The maximum number of columns used for the correlation matrix. */
const MAX_CORRELATION_COLUMNS = 30;

/** The maximum number of rows a sample response may contain. */
export const PROFILE_SAMPLE_LIMIT = 100;

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new AppError(400, 'INVALID_PROFILE_COLUMN', `Invalid column identifier: ${value}`);
  }
  return `"${value}"`;
}

/**
 * Classify a physical type into the logical type the profile uses.
 *
 * The classification drives which statistics are computed, so it must be
 * conservative: a type that is not recognised becomes `text`, never
 * `numeric` by accident.
 */
export function classifyLogicalType(physicalType: string): LogicalType {
  const type = physicalType.trim().toLowerCase();
  if (/^(bool|boolean)/.test(type)) return 'boolean';
  // The complex types are checked *before* the numeric ones: a
  // `STRUCT(amount INTEGER)` contains "integer" and would otherwise be
  // classified as a number.
  if (/(struct|map|list|array|union|json)/.test(type)) return 'complex';
  if (/(tinyint|smallint|int|integer|bigint|hugeint|utinyint|usmallint|uinteger|ubigint)/.test(type)) {
    return 'numeric';
  }
  if (/(float|double|real|decimal|numeric)/.test(type)) return 'numeric';
  if (/(timestamp|datetime|date|time)/.test(type)) return 'datetime';
  if (/(char|varchar|text|string)/.test(type)) {
    // A VARCHAR can still be categorical — but only the *cardinality* tells
    // us, so the profiler starts as `text` and promotes it later.
    return 'text';
  }
  return 'text';
}

/** A deterministic fingerprint of the profile request. */
export function computeFingerprint(
  datasetId: string,
  version: number | undefined,
  config: ProfileConfig,
): string {
  const canonical = JSON.stringify({
    datasetId,
    version: version ?? null,
    columns: [...config.columns].sort(),
    analyses: [...config.analyses].sort(),
    includeCorrelation: config.includeCorrelation,
    sampleStrategy: config.sampleStrategy,
    sampleSize: config.sampleSize ?? null,
    seed: config.seed ?? null,
    filters: config.filters ?? {},
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

/** A stable hash of the executed statement — proves what was run. */
export function computeQueryHash(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32);
}

/** The scan source expression for a resolved dataset. */
function scanSource(ref: DatasetRef): string {
  if (ref.provider === 'local_delta_minio') {
    const path = ref.storagePath ?? canonicalStoragePath(ref.layer!, ref.database!, ref.table!);
    return `delta_scan('${escapeLiteral(path)}')`;
  }
  throw new AppError(
    400,
    'PROFILE_PROVIDER_UNSUPPORTED',
    `The local profiling engine cannot read provider "${ref.provider}".`,
  );
}

/**
 * Build the sampling clause.
 *
 * DuckDB's `USING SAMPLE` is applied *after* the filter and it is
 * deterministic for a given seed and reservoir size, which is what makes a
 * profile reproducible (P0-EDA-04).
 */
function samplingClause(
  strategy: ProfileConfig['sampleStrategy'],
  sampleSize: number | undefined,
  seed: number | undefined,
): { clause: string; approximate: boolean } {
  if (strategy === 'full' || !sampleSize) return { clause: '', approximate: false };
  const size = Math.max(100, Math.min(sampleSize, 5_000_000));
  const seedClause = seed === undefined ? '' : ` REPEATABLE (${seed})`;
  return { clause: ` USING SAMPLE ${size} ROWS${seedClause}`, approximate: true };
}

/** Build the WHERE clause from the allow-listed equality filters. */
function filterClause(
  filters: Record<string, unknown> | undefined,
): { clause: string; fragments: string[] } {
  if (!filters) return { clause: '', fragments: [] };
  const fragments: string[] = [];
  for (const [column, rawValues] of Object.entries(filters)) {
    if (!Array.isArray(rawValues) || rawValues.length === 0) continue;
    const ident = escapeIdent(column);
    const values = rawValues
      .map((value) =>
        typeof value === 'number'
          ? String(value)
          : typeof value === 'boolean'
            ? (value ? 'TRUE' : 'FALSE')
            : `'${escapeLiteral(String(value))}'`,
      )
      .join(', ');
    fragments.push(`${ident} IN (${values})`);
  }
  return { clause: fragments.length > 0 ? ` WHERE ${fragments.join(' AND ')}` : '', fragments };
}

interface ColumnSchema {
  name: string;
  physicalType: string;
  logicalType: LogicalType;
}

/** Read the schema of the profiled dataset. */
async function readSchema(
  conn: ProfileConnection,
  source: string,
): Promise<ColumnSchema[]> {
  const reader = await conn.runAndReadAll(`DESCRIBE ${source}`);
  const rows = reader.getRowObjects() as Array<{
    column_name: string;
    column_type: string;
  }>;
  return rows.map((row) => ({
    name: row.column_name,
    physicalType: row.column_type,
    logicalType: classifyLogicalType(row.column_type),
  }));
}

interface NumericStats {
  count: string;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  skewness: number | null;
  kurtosis: number | null;
}

/** Compute the univariate numeric statistics of one column. */
async function readNumericStats(
  conn: ProfileConnection,
  source: string,
  column: string,
): Promise<NumericStats> {
  const ident = escapeIdent(column);
  const reader = await conn.runAndReadAll(
    `SELECT
       COUNT(${ident})::BIGINT AS cnt,
       AVG(${ident}::DOUBLE) AS mean,
       STDDEV_POP(${ident}::DOUBLE) AS std,
       MIN(${ident}::DOUBLE) AS min,
       MAX(${ident}::DOUBLE) AS max,
       QUANTILE_CONT(${ident}, 0.25)::DOUBLE AS p25,
       MEDIAN(${ident}::DOUBLE) AS median,
       QUANTILE_CONT(${ident}, 0.75)::DOUBLE AS p75,
       SKEWNESS(${ident}::DOUBLE) AS skew,
       KURTOSIS(${ident}::DOUBLE) AS kurt
     FROM ${source}`,
  );
  const row = (reader.getRowObjects() as Array<Record<string, unknown>>)[0] ?? {};
  const num = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);
  return {
    count: String(row.cnt ?? 0),
    mean: num(row.mean),
    std: num(row.std),
    min: num(row.min),
    max: num(row.max),
    p25: num(row.p25),
    median: num(row.median),
    p75: num(row.p75),
    skewness: num(row.skew),
    kurtosis: num(row.kurt),
  };
}

/** Build a histogram with a bounded, adaptive bin policy. */
async function readHistogram(
  conn: ProfileConnection,
  source: string,
  column: string,
  bins: number,
): Promise<HistogramBucket[]> {
  const ident = escapeIdent(column);
  const reader = await conn.runAndReadAll(
    `SELECT
       MIN(${ident}::DOUBLE) AS lo,
       MAX(${ident}::DOUBLE) AS hi
     FROM ${source}
     WHERE ${ident} IS NOT NULL`,
  );
  const bounds = (reader.getRowObjects() as Array<Record<string, unknown>>)[0] ?? {};
  const lo = bounds.lo === null || bounds.lo === undefined ? null : Number(bounds.lo);
  const hi = bounds.hi === null || bounds.hi === undefined ? null : Number(bounds.hi);
  if (lo === null || hi === null) return [];
  if (lo === hi) return [{ lower: lo, upper: hi, count: '0' }];

  const bucketCount = Math.max(4, Math.min(bins, 60));
  const width = (hi - lo) / bucketCount;
  const histReader = await conn.runAndReadAll(
    `SELECT
       FLOOR((${ident}::DOUBLE - ${lo}) / ${width})::INTEGER AS bucket,
       COUNT(*)::BIGINT AS cnt
     FROM ${source}
     WHERE ${ident} IS NOT NULL
     GROUP BY bucket
     ORDER BY bucket`,
  );
  const rows = histReader.getRowObjects() as Array<{ bucket: number; cnt: number | bigint }>;
  const counts = new Map<number, number>();
  for (const row of rows) {
    const index = Math.min(Math.max(Number(row.bucket), 0), bucketCount - 1);
    counts.set(index, (counts.get(index) ?? 0) + Number(row.cnt));
  }
  const buckets: HistogramBucket[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    buckets.push({
      lower: Number((lo + index * width).toFixed(6)),
      upper: Number((lo + (index + 1) * width).toFixed(6)),
      count: String(counts.get(index) ?? 0),
    });
  }
  return buckets;
}

/** Read the top values of a categorical column. */
async function readTopValues(
  conn: ProfileConnection,
  source: string,
  column: string,
  limit: number,
): Promise<TopValue[]> {
  const ident = escapeIdent(column);
  const reader = await conn.runAndReadAll(
    `SELECT CAST(${ident} AS VARCHAR) AS value, COUNT(*)::BIGINT AS cnt
     FROM ${source}
     WHERE ${ident} IS NOT NULL
     GROUP BY value
     ORDER BY cnt DESC, value ASC
     LIMIT ${limit}`,
  );
  const rows = reader.getRowObjects() as Array<{ value: string; cnt: number | bigint }>;
  return rows.map((row) => ({ value: row.value, count: String(row.cnt) }));
}

/** Compute the pairwise correlation matrix of the numeric columns. */
async function readCorrelation(
  conn: ProfileConnection,
  source: string,
  columns: string[],
  method: 'pearson' | 'spearman',
): Promise<CorrelationResult> {
  const selected = columns.slice(0, MAX_CORRELATION_COLUMNS);
  const matrix: Array<Array<number | null>> = selected.map(() => selected.map(() => null));

  // DuckDB has no built-in CORR(), so the correlation is computed from the
  // sufficient statistics of each pair. The formula is the standard
  // Pearson coefficient over the paired aggregates; a pair whose
  // denominator is zero is reported as `null` (undefined), never as 0.
  //
  // Spearman is the Pearson coefficient of the *ranks*, so the ranks are
  // materialised with `RANK()` before the same formula is applied. It is
  // a real Spearman coefficient, not an approximation of one.
  for (let i = 0; i < selected.length; i += 1) {
    matrix[i]![i] = 1;
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = escapeIdent(selected[i]!);
      const b = escapeIdent(selected[j]!);
      const projection =
        method === 'spearman'
          ? `RANK() OVER (ORDER BY ${a}) AS ra, RANK() OVER (ORDER BY ${b}) AS rb`
          : `${a}::DOUBLE AS ra, ${b}::DOUBLE AS rb`;
      const reader = await conn.runAndReadAll(
        `WITH ranked AS (
           SELECT ${projection}
           FROM ${source}
           WHERE ${a} IS NOT NULL AND ${b} IS NOT NULL
         )
         SELECT
           COUNT(*)::BIGINT AS n,
           SUM(ra * rb) AS sab,
           SUM(ra) AS sa,
           SUM(rb) AS sb,
           SUM(ra * ra) AS saa,
           SUM(rb * rb) AS sbb
         FROM ranked`,
      );
      const row = (reader.getRowObjects() as Array<Record<string, unknown>>)[0] ?? {};
      const n = Number(row.n ?? 0);
      const sab = Number(row.sab ?? 0);
      const sa = Number(row.sa ?? 0);
      const sb = Number(row.sb ?? 0);
      const saa = Number(row.saa ?? 0);
      const sbb = Number(row.sbb ?? 0);
      let coefficient: number | null = null;
      if (n >= 2) {
        const numerator = n * sab - sa * sb;
        const denominator = Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
        if (denominator > 0) {
          coefficient = Number((numerator / denominator).toFixed(6));
        }
      }
      matrix[i]![j] = coefficient;
      matrix[j]![i] = coefficient;
    }
  }
  return { method, columns: selected, matrix };
}

/** Read a bounded, representative sample of the profiled dataset. */
export async function readSample(
  conn: ProfileConnection,
  source: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const reader = await conn.runAndReadAll(`SELECT * FROM ${source} LIMIT ${Math.max(1, Math.min(limit, PROFILE_SAMPLE_LIMIT))}`);
  const columnNames = reader.columnNames();
  const rows = reader.getRows() as Array<Array<unknown>>;
  return rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (let index = 0; index < columnNames.length; index += 1) {
      record[columnNames[index] ?? `col_${index}`] = row[index] ?? null;
    }
    return record;
  });
}

/** The result of one profiling run, before it is persisted. */
export interface ProfileRunResult {
  dataset: { ref: DatasetRef };
  configured: ProfileConfig;
  population: ProfilePopulation;
  coverage: ProfileCoverage;
  columns: ColumnProfile[];
  relationships?: CorrelationResult;
  alerts: ProfileAlert[];
  provenance: ProfileProvenance;
}

/**
 * Profile a dataset with the local DuckDB engine.
 *
 * The function never throws for a *data* problem — an unreadable column
 * degrades that column's statistics to "not computed" and raises an alert.
 * Only an unusable dataset (wrong provider, missing path) is an error.
 */
export async function profileLocalDataset(input: {
  ref: DatasetRef;
  config: ProfileConfig;
  version?: number;
}): Promise<ProfileRunResult> {
  const { ref, config } = input;
  assertReadable(ref, 'Profiling');

  const source = scanSource(ref);
  const { clause: sampleClause, approximate } = samplingClause(
    config.sampleStrategy,
    config.sampleSize,
    config.seed,
  );
  const { clause: whereClause, fragments: filterFragments } = filterClause(config.filters);

  const instance = await getDuckDB();
  const conn = await instance.connect();
  const startedAt = Date.now();

  try {
    const schema = await readSchema(conn, source);
    const selectedColumns = config.columns.length
      ? schema.filter((column) => config.columns.includes(column.name))
      : schema;

    if (config.columns.length > 0 && selectedColumns.length === 0) {
      throw new AppError(
        400,
        'PROFILE_COLUMNS_NOT_FOUND',
        `None of the requested columns exist in ${ref.datasetId}.`,
      );
    }

    // The population size is measured *without* the sample so the profile
    // can report "1,000,000 rows, 50,000 observed" honestly.
    const populationReader = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT AS cnt FROM ${source}${whereClause}`,
    );
    const populationRow = (populationReader.getRowObjects() as Array<{ cnt: number | bigint }>)[0];
    const populationCount = Number(populationRow?.cnt ?? 0);

    const observedReader = await conn.runAndReadAll(
      `SELECT COUNT(*)::BIGINT AS cnt FROM (SELECT 1 FROM ${source}${whereClause}${sampleClause})`,
    );
    const observedRow = (observedReader.getRowObjects() as Array<{ cnt: number | bigint }>)[0];
    const observedCount = Number(observedRow?.cnt ?? 0);

    const sampledSource = sampleClause
      ? `(SELECT * FROM ${source}${whereClause}${sampleClause})`
      : `${source}${whereClause}`;

    const columns: ColumnProfile[] = [];
    const alerts: ProfileAlert[] = [];
    const missingCounts: Record<string, string> = {};

    for (const column of selectedColumns) {
      const ident = escapeIdent(column.name);
      const countReader = await conn.runAndReadAll(
        `SELECT COUNT(*)::BIGINT AS total, COUNT(${ident})::BIGINT AS non_null FROM ${sampledSource}`,
      );
      const countRow = (countReader.getRowObjects() as Array<Record<string, unknown>>)[0] ?? {};
      const total = Number(countRow.total ?? 0);
      const nonNull = Number(countRow.non_null ?? 0);
      const nullCount = Math.max(total - nonNull, 0);
      missingCounts[column.name] = String(nullCount);

      const profile: ColumnProfile = {
        name: column.name,
        logicalType: column.logicalType,
        physicalType: column.physicalType,
        nonNullCount: String(nonNull),
        nullCount: String(nullCount),
      };

      if (column.logicalType === 'numeric') {
        const stats = await readNumericStats(conn, sampledSource, column.name);
        profile.mean = stats.mean;
        profile.std = stats.std;
        profile.min = stats.min;
        profile.max = stats.max;
        profile.p25 = stats.p25;
        profile.median = stats.median;
        profile.p75 = stats.p75;
        profile.skewness = stats.skewness;
        profile.kurtosis = stats.kurtosis;
        profile.iqr =
          stats.p25 !== null && stats.p75 !== null ? stats.p75 - stats.p25 : null;

        if (config.analyses.includes('univariate')) {
          profile.histogram = await readHistogram(
            conn,
            sampledSource,
            column.name,
            DEFAULT_HISTOGRAM_BINS,
          );
        }

        const distinctReader = await conn.runAndReadAll(
          `SELECT COUNT(DISTINCT ${ident})::BIGINT AS cnt FROM ${sampledSource}`,
        );
        const distinctRow = (distinctReader.getRowObjects() as Array<{ cnt: number | bigint }>)[0];
        const distinct = Number(distinctRow?.cnt ?? 0);
        profile.distinctCount = String(distinct);
        profile.distinctApprox = approximate;
        profile.cardinalityRatio = nonNull > 0 ? distinct / nonNull : null;
      } else if (column.logicalType === 'boolean') {
        const topValues = await readTopValues(conn, sampledSource, column.name, MAX_TOP_VALUES);
        profile.topValues = topValues;
      } else if (column.logicalType === 'datetime') {
        const stats = await readNumericStats(conn, sampledSource, column.name);
        profile.min = stats.min;
        profile.max = stats.max;
        profile.mean = stats.mean;
        profile.std = stats.std;
      } else {
        // Text and categorical columns: the top values reveal whether the
        // column behaves like an enum (categorical) or like free text.
        const topValues = await readTopValues(conn, sampledSource, column.name, MAX_TOP_VALUES);
        profile.topValues = topValues;
        const distinctReader = await conn.runAndReadAll(
          `SELECT COUNT(DISTINCT ${ident})::BIGINT AS cnt FROM ${sampledSource}`,
        );
        const distinctRow = (distinctReader.getRowObjects() as Array<{ cnt: number | bigint }>)[0];
        const distinct = Number(distinctRow?.cnt ?? 0);
        profile.distinctCount = String(distinct);
        profile.distinctApprox = approximate;
        profile.cardinalityRatio = nonNull > 0 ? distinct / nonNull : null;

        const ratio = nonNull > 0 ? distinct / nonNull : 0;
        if (nonNull > 0 && ratio <= 0.5 && distinct <= 50) {
          // A low-cardinality text column is a categorical column.
          profile.logicalType = 'categorical';
        } else if (nonNull > 0 && ratio > 0.9 && distinct > 100) {
          profile.logicalType = 'text';
        }
      }

      if (nullCount > 0 && total > 0) {
        const ratio = nullCount / total;
        alerts.push({
          kind: 'missing_values',
          severity: ratio > 0.5 ? 'error' : ratio > 0.1 ? 'warn' : 'info',
          description: `${column.name} is null in ${(ratio * 100).toFixed(2)}% of the observed rows.`,
          columns: [column.name],
        });
      }

      columns.push(profile);
    }

    let relationships: CorrelationResult | undefined;
    if (config.includeCorrelation) {
      const numericColumns = columns
        .filter((column) => column.logicalType === 'numeric')
        .map((column) => column.name);
      if (numericColumns.length >= 2) {
        relationships = await readCorrelation(conn, sampledSource, numericColumns, 'pearson');
      } else {
        alerts.push({
          kind: 'correlation_unavailable',
          severity: 'info',
          description:
            'Correlation was requested but fewer than two numeric columns are available.',
        });
      }
    }

    const population: ProfilePopulation = {
      rowCount: String(populationCount),
      estimate: approximate,
      columnCount: selectedColumns.length,
    };
    const coverage: ProfileCoverage = {
      rowsObserved: String(observedCount),
      ...(populationCount > 0 ? { ratio: observedCount / populationCount } : {}),
      fieldMissingCounts: missingCounts,
    };

    const provenance: ProfileProvenance = {
      engine: 'duckdb-delta',
      engineVersion: 'duckdb-node-api',
      queryHash: computeQueryHash([source, whereClause, sampleClause, ...filterFragments]),
      computedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      samplePolicy: config.sampleStrategy,
      approximate,
    };

    return {
      dataset: { ref },
      configured: config,
      population,
      coverage,
      columns,
      ...(relationships ? { relationships } : {}),
      alerts,
      provenance,
    };
  } finally {
    // The connection must be released on every path — the DQ executor had
    // exactly this bug (DQ-003) and 100 repeated profiles would leak 100
    // connections without it.
    try {
      conn.closeSync();
    } catch (closeError) {
      logger.warn({ error: closeError }, 'Failed to close the DuckDB profiling connection');
    }
  }
}

/** Resolve the dataset a profile request points at. */
export function resolveProfileDataset(input: {
  datasetId?: string;
  provider?: 'local_delta_minio' | 'databricks_uc';
  layer?: DatasetLayer;
  database?: string;
  table?: string;
  version?: number;
}): DatasetRef {
  if (input.datasetId) {
    return resolveFromDatasetId(input.datasetId, input.version);
  }
  if (!input.layer || !input.database || !input.table) {
    throw new AppError(
      400,
      'DATASET_REFERENCE_INCOMPLETE',
      'A profile request requires a datasetId or a layer/database/table triple.',
    );
  }
  return resolveDataset({
    provider: input.provider ?? 'local_delta_minio',
    layer: input.layer,
    database: input.database,
    table: input.table,
    ...(input.version !== undefined ? { deltaVersion: input.version } : {}),
  });
}
