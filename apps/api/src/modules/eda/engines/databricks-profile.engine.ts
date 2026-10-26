import { AppError } from '@/errors';
import { readStatement } from '@/lib/infra/databricks/client';
import { logger } from '@/lib/logger';
import type { DatasetRef } from '@/modules/datasets/types';
import type {
  ColumnProfile,
  CorrelationResult,
  LogicalType,
  ProfileAlert,
  ProfileConfig,
  ProfileCoverage,
  ProfilePopulation,
  ProfileProvenance,
  TopValue,
} from '../types';
import { classifyLogicalType, computeQueryHash } from './local-profile.engine';

/**
 * The Databricks Unity Catalog profiling adapter.
 *
 * MASTER PLAN §07.1: "Databricks UC: curated SQL templates executed
 * through approved SQL Warehouse (read-only), bounded async statement
 * execution; existing `readStatement()` has 25s deadline and 1,000-row
 * preview, so build **new profiling query/async result path** rather than
 * feeding all raw rows through preview API."
 *
 * The adapter therefore:
 *
 *  * never sends a raw row to the browser — every statement is an
 *    *aggregate* that returns a handful of rows;
 *  * uses the approved read-only statement path, so the write guard of
 *    the warehouse still applies;
 *  * marks the result `approximate` when the query could not be bounded
 *    exactly (e.g. `COUNT(DISTINCT)` above the scan budget);
 *  * reports a *failed* profile when the warehouse is unavailable, rather
 *    than an empty profile that looks like "the dataset has no data".
 */

/** The maximum number of columns a UC profile inspects. */
const MAX_UC_COLUMNS = 60;

/** The maximum number of top values per categorical column. */
const MAX_UC_TOP_VALUES = 20;

export interface DatabricksProfileInput {
  ref: DatasetRef;
  config: ProfileConfig;
}

export interface DatabricksProfileResult {
  population: ProfilePopulation;
  coverage: ProfileCoverage;
  columns: ColumnProfile[];
  relationships?: CorrelationResult;
  alerts: ProfileAlert[];
  provenance: ProfileProvenance;
}

function escapeIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new AppError(400, 'INVALID_PROFILE_COLUMN', `Invalid column identifier: ${value}`);
  }
  return `\`${value}\``;
}

/** Read the schema of the Unity Catalog table. */
async function readSchema(
  qualifiedName: string,
): Promise<Array<{ name: string; physicalType: string; logicalType: LogicalType }>> {
  const rows = await readStatement(`DESCRIBE ${qualifiedName}`, 500);
  return rows
    .filter((row) => typeof row.col_name === 'string' && typeof row.data_type === 'string')
    .map((row) => {
      const physicalType = String(row.data_type);
      return {
        name: String(row.col_name),
        physicalType,
        logicalType: classifyLogicalType(physicalType),
      };
    });
}

/**
 * Profile a Unity Catalog table.
 *
 * The statement path is aggregate-only, so the 1,000-row preview limit of
 * `readStatement` never truncates a result.
 */
export async function profileDatabricksDataset(
  input: DatabricksProfileInput,
): Promise<DatabricksProfileResult> {
  const { ref, config } = input;
  const qualifiedName = ref.qualifiedName;
  if (!qualifiedName) {
    throw new AppError(
      400,
      'PROFILE_PROVIDER_UNSUPPORTED',
      'The Databricks profile adapter requires a qualified table name.',
    );
  }

  const startedAt = Date.now();
  const schema = await readSchema(qualifiedName);
  const selected = config.columns.length
    ? schema.filter((column) => config.columns.includes(column.name))
    : schema.slice(0, MAX_UC_COLUMNS);

  if (config.columns.length > 0 && selected.length === 0) {
    throw new AppError(
      400,
      'PROFILE_COLUMNS_NOT_FOUND',
      `None of the requested columns exist in ${ref.datasetId}.`,
    );
  }

  const populationRows = await readStatement(`SELECT COUNT(*) AS total FROM ${qualifiedName}`, 10);
  const populationCount = Number(populationRows[0]?.total ?? 0);

  const columns: ColumnProfile[] = [];
  const alerts: ProfileAlert[] = [];
  const missingCounts: Record<string, string> = {};

  for (const column of selected) {
    const ident = escapeIdent(column.name);
    const countRows = await readStatement(
      `SELECT COUNT(*) AS total, COUNT(${ident}) AS non_null FROM ${qualifiedName}`,
      10,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const nonNull = Number(countRows[0]?.non_null ?? 0);
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
      const statsRows = await readStatement(
        `SELECT
           AVG(${ident}) AS mean,
           STDDEV_POP(${ident}) AS std,
           MIN(${ident}) AS min,
           MAX(${ident}) AS max,
           PERCENTILE_APPROX(${ident}, 0.25) AS p25,
           PERCENTILE_APPROX(${ident}, 0.50) AS median,
           PERCENTILE_APPROX(${ident}, 0.75) AS p75
         FROM ${qualifiedName}`,
        10,
      );
      const stats = statsRows[0] ?? {};
      const num = (value: unknown): number | null =>
        value === null || value === undefined ? null : Number(value);
      profile.mean = num(stats.mean);
      profile.std = num(stats.std);
      profile.min = num(stats.min);
      profile.max = num(stats.max);
      profile.p25 = num(stats.p25);
      profile.median = num(stats.median);
      profile.p75 = num(stats.p75);
      profile.iqr =
        profile.p25 !== null && profile.p75 !== null ? profile.p75 - profile.p25 : null;
      // `PERCENTILE_APPROX` is an approximation by construction, so the
      // profile must disclose it rather than claim exact quantiles.
      profile.distinctApprox = true;
    } else if (column.logicalType === 'boolean') {
      profile.topValues = await readTopValues(qualifiedName, column.name);
    } else if (column.logicalType === 'datetime') {
      const rangeRows = await readStatement(
        `SELECT MIN(${ident}) AS min, MAX(${ident}) AS max FROM ${qualifiedName}`,
        10,
      );
      const min = rangeRows[0]?.min;
      const max = rangeRows[0]?.max;
      profile.min = min === null || min === undefined ? null : String(min);
      profile.max = max === null || max === undefined ? null : String(max);
    } else {
      profile.topValues = await readTopValues(qualifiedName, column.name);
      const distinctRows = await readStatement(
        `SELECT COUNT(DISTINCT ${ident}) AS cnt FROM ${qualifiedName}`,
        10,
      );
      const distinct = Number(distinctRows[0]?.cnt ?? 0);
      profile.distinctCount = String(distinct);
      profile.distinctApprox = true;
      profile.cardinalityRatio = nonNull > 0 ? distinct / nonNull : null;
      const ratio = nonNull > 0 ? distinct / nonNull : 0;
      if (nonNull > 0 && ratio <= 0.5 && distinct <= 50) {
        profile.logicalType = 'categorical';
      }
    }

    if (nullCount > 0 && total > 0) {
      const ratio = nullCount / total;
      alerts.push({
        kind: 'missing_values',
        severity: ratio > 0.5 ? 'error' : ratio > 0.1 ? 'warn' : 'info',
        description: `${column.name} is null in ${(ratio * 100).toFixed(2)}% of the rows.`,
        columns: [column.name],
      });
    }

    columns.push(profile);
  }

  let relationships: CorrelationResult | undefined;
  if (config.includeCorrelation) {
    const numeric = columns.filter((c) => c.logicalType === 'numeric').map((c) => c.name);
    if (numeric.length >= 2) {
      relationships = await readCorrelation(qualifiedName, numeric);
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
    estimate: false,
    columnCount: selected.length,
  };
  const coverage: ProfileCoverage = {
    rowsObserved: String(populationCount),
    ...(populationCount > 0 ? { ratio: 1 } : {}),
    fieldMissingCounts: missingCounts,
  };

  const provenance: ProfileProvenance = {
    engine: 'databricks-sql-warehouse',
    queryHash: computeQueryHash([qualifiedName, ...selected.map((c) => c.name)]),
    computedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    samplePolicy: 'full',
    // The UC adapter always reports approximate because `PERCENTILE_APPROX`
    // and the distinct-count estimate are approximations.
    approximate: true,
  };

  logger.info(
    { datasetId: ref.datasetId, columns: columns.length, elapsedMs: provenance.elapsedMs },
    'Databricks profile computed',
  );

  return {
    population,
    coverage,
    columns,
    ...(relationships ? { relationships } : {}),
    alerts,
    provenance,
  };
}

async function readTopValues(qualifiedName: string, column: string): Promise<TopValue[]> {
  const ident = escapeIdent(column);
  const rows = await readStatement(
    `SELECT CAST(${ident} AS STRING) AS value, COUNT(*) AS cnt
     FROM ${qualifiedName}
     WHERE ${ident} IS NOT NULL
     GROUP BY value
     ORDER BY cnt DESC
     LIMIT ${MAX_UC_TOP_VALUES}`,
    MAX_UC_TOP_VALUES,
  );
  return rows.map((row) => ({ value: String(row.value ?? ''), count: String(row.cnt ?? 0) }));
}

/**
 * The pairwise correlation of the numeric columns.
 *
 * Databricks SQL has `CORR()`, which is the Pearson coefficient — so the
 * adapter uses it directly instead of re-deriving the formula.
 */
async function readCorrelation(
  qualifiedName: string,
  columns: string[],
): Promise<CorrelationResult> {
  const selected = columns.slice(0, 30);
  const matrix: Array<Array<number | null>> = selected.map(() => selected.map(() => null));

  for (let i = 0; i < selected.length; i += 1) {
    matrix[i]![i] = 1;
    for (let j = i + 1; j < selected.length; j += 1) {
      const a = escapeIdent(selected[i]!);
      const b = escapeIdent(selected[j]!);
      const rows = await readStatement(
        `SELECT CORR(${a}, ${b}) AS coefficient
         FROM ${qualifiedName}
         WHERE ${a} IS NOT NULL AND ${b} IS NOT NULL`,
        5,
      );
      const raw = rows[0]?.coefficient;
      const coefficient =
        raw === null || raw === undefined ? null : Number(Number(raw).toFixed(6));
      matrix[i]![j] = coefficient;
      matrix[j]![i] = coefficient;
    }
  }
  return { method: 'pearson', columns: selected, matrix };
}
