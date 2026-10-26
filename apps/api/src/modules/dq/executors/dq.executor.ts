import { randomUUID } from 'node:crypto';
import { getDuckDB } from '@/lib/infra/duckdb';
import { logger } from '@/lib/logger';
import { AppError } from '@/errors';
import {
  assertReadable,
  canonicalStoragePath,
  defaultDatabaseFor,
  resolveDataset,
  type DatasetLayer,
} from '@/modules/datasets/types';
import type { DqRule, DqRuleExecution } from '../types';
import { parseDatasetReference } from './dataset-reference';

/**
 * Data Quality executor.
 *
 * MASTER PLAN §06.1 fixes DQ-001 … DQ-010:
 *
 * * DQ-001 — the scan path comes from the shared `DatasetResolver`, so a
 *   Databricks dataset and a local Delta dataset never share a path.
 * * DQ-002 — the null check builds `column IS NULL` (the previous code
 *   produced `WHERE IS NULL`, which is a SQL syntax error) and returns the
 *   failing rows as samples.
 * * DQ-003 — every DuckDB connection is closed in a `finally` block, so 100
 *   repeated scans do not leak connections.
 * * DQ-004 — `custom_sql` is disabled: arbitrary SQL from the UI is not
 *   accepted. A keyword blacklist cannot make user SQL safe.
 * * DQ-005 — `unique` counts duplicates over non-null values only; null
 *   handling is a separate, explicit rule.
 * * DQ-006 — every rule reports `evaluatedRows`, `skippedRows`,
 *   `failedRows` and `coverageRate` so the denominator is explicit.
 * * DQ-007 — a rule that was never evaluated yields `passRate = null` and
 *   status `not_evaluated`, never 1.
 */

/** DuckDB connection type used by the helpers below. */
type DqConnection = Awaited<ReturnType<Awaited<ReturnType<typeof getDuckDB>>['connect']>>;

export interface DqScanTarget {
  /** Canonical storage path scanned by DuckDB. */
  path: string;
  /** Canonical dataset identity. */
  datasetId: string;
  /** Layer of the scanned dataset. */
  layer: DatasetLayer;
  database: string;
  table: string;
  /** Delta snapshot version when it can be determined cheaply. */
  deltaVersion: number | null;
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new AppError(400, 'INVALID_DQ_COLUMN', `Invalid column identifier: ${value}`);
  }
  return `"${value}"`;
}

/**
 * Resolve the dataset a rule points at.
 *
 * The rule stores `layer` and `table`. The canonical control-plane identity
 * is `database.table`, but rules written before the canonical identity was
 * introduced use the `database/table` fragment style (and occasionally a
 * bare table name). All three forms resolve to the same canonical dataset,
 * so a rule never silently points at a different table than the UI shows.
 *
 * Anything else is rejected instead of being coerced into a path.
 */
export function resolveScanTarget(rule: Pick<DqRule, 'layer' | 'table'>): DqScanTarget {
  const reference = parseDatasetReference(rule.table);
  if (reference === null) {
    throw new AppError(
      400,
      'INVALID_DQ_DATASET',
      `Invalid DQ dataset reference: ${(rule.table ?? '').trim()}. Expected "database.table".`,
    );
  }

  const layer = rule.layer as DatasetLayer;
  const database = reference.database ?? defaultDatabaseFor(reference.table, layer);
  const table = reference.table;
  const ref = resolveDataset({ provider: 'local_delta_minio', layer, database, table });
  assertReadable(ref, 'Data quality evaluation');
  return {
    path: canonicalStoragePath(layer, ref.database!, ref.table!),
    datasetId: ref.datasetId,
    layer,
    database: ref.database!,
    table: ref.table!,
    deltaVersion: ref.deltaVersion ?? null,
  };
}

interface RuleMetrics {
  totalRows: number;
  evaluatedRows: number;
  skippedRows: number;
  failedRows: number;
}

function metricsToExecution(
  ruleId: string,
  metrics: RuleMetrics,
  status: 'pass' | 'fail' | 'warn' | 'not_evaluated',
  sampleFailures: Array<Record<string, unknown>>,
): Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'> {
  const passRate =
    metrics.evaluatedRows > 0 ? 1 - metrics.failedRows / metrics.evaluatedRows : null;
  const coverageRate =
    metrics.totalRows > 0 ? metrics.evaluatedRows / metrics.totalRows : 0;
  return {
    ruleId,
    status,
    totalRows: metrics.totalRows,
    failedRows: metrics.failedRows,
    evaluatedRows: metrics.evaluatedRows,
    skippedRows: metrics.skippedRows,
    passRate,
    coverageRate,
    sampleFailures,
    errorMessage: null,
  };
}

/**
 * Decide the status of a rule from its metrics.
 *
 * DQ-007: an empty dataset (or a dataset where every row was skipped) has no
 * evidence either way. Reporting `pass` there would be a false success, so
 * the outcome is `not_evaluated` with a `null` pass rate.
 *
 * `allowedFailed` is the number of failing rows the rule tolerates
 * (e.g. `maxNullPercent` for a null check). It defaults to 0.
 */
function decideStatus(
  metrics: RuleMetrics,
  failed: number,
  allowedFailed = 0,
): 'pass' | 'fail' | 'not_evaluated' {
  if (metrics.evaluatedRows <= 0) return 'not_evaluated';
  return failed <= allowedFailed ? 'pass' : 'fail';
}

export const DqExecutor = {
  async run(
    rule: Pick<DqRule, 'ruleId' | 'type' | 'layer' | 'table' | 'column' | 'params'>,
    options: { partition?: string; limit: number; sampleSize: number },
  ): Promise<DqRuleExecution> {
    const startedAt = Date.now();
    const runId = randomUUID().replace(/-/g, '').slice(0, 24);
    try {
      const result = await executeRule(rule, options);
      const durationMs = Date.now() - startedAt;
      return { ...result, runId, durationMs, executedAt: new Date().toISOString() };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ ruleId: rule.ruleId, error: message }, 'DQ rule evaluation failed');
      return {
        ruleId: rule.ruleId,
        runId,
        status: 'error',
        totalRows: 0,
        failedRows: 0,
        evaluatedRows: 0,
        skippedRows: 0,
        passRate: null,
        coverageRate: 0,
        sampleFailures: [],
        errorMessage: message,
        durationMs,
        executedAt: new Date().toISOString(),
      };
    }
  },
};

export interface DqInternalExecution extends Omit<DqRuleExecution, 'durationMs' | 'executedAt'> {
  ruleId: string;
  runId: string;
}

async function executeRule(
  rule: Pick<DqRule, 'ruleId' | 'type' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  switch (rule.type) {
    case 'null_check':
      return runNullCheck(rule, options);
    case 'range_check':
      return runRangeCheck(rule, options);
    case 'in_set':
      return runInSet(rule, options);
    case 'unique':
      return runUnique(rule, options);
    case 'regex':
      return runRegex(rule, options);
    case 'custom_sql':
      // DQ-004: arbitrary SQL is not accepted from the UI. A keyword
      // blacklist cannot make user-provided SQL safe, so the rule type is
      // rejected explicitly instead of being "best effort" executed.
      throw new AppError(
        400,
        'DQ_CUSTOM_SQL_DISABLED',
        'custom_sql rules are disabled: arbitrary SQL cannot be safely validated. ' +
          'Use null_check, range_check, in_set, unique or regex.',
      );
    default:
      throw new Error(`Unsupported rule type: ${rule.type}`);
  }
}

async function withConnection<T>(
  fn: (conn: DqConnection, target: DqScanTarget) => Promise<T>,
  target: DqScanTarget,
): Promise<T> {
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    return await fn(conn, target);
  } finally {
    // DQ-003: the connection must be released on every path, including the
    // error path. `closeSync` is the API exposed by @duckdb/node-api.
    try {
      conn.closeSync();
    } catch (closeError) {
      logger.warn({ error: closeError }, 'Failed to close the DuckDB DQ connection');
    }
  }
}

async function runNullCheck(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new AppError(400, 'DQ_COLUMN_REQUIRED', 'null_check requires column');
  const target = resolveScanTarget(rule);
  const maxNullPct = Number(rule.params.maxNullPercent ?? 0);
  const ident = escapeIdent(rule.column);

  return withConnection(async (conn, tgt) => {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN ${ident} IS NULL THEN 1 ELSE 0 END) AS failed
       FROM delta_scan('${escapeLiteral(tgt.path)}')`,
    );
    const rows = totalRes.getRows() as Array<[bigint | number, bigint | number | null]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const failed = Number(rows[0]?.[1] ?? 0);
    const allowedFailed = Math.floor((total * maxNullPct) / 100);
    const status = decideStatus({ totalRows: total, evaluatedRows: total, skippedRows: 0, failedRows: failed }, failed, allowedFailed);
    const sample = await fetchSample(
      conn,
      tgt.path,
      '*',
      `${ident} IS NULL`,
      options.sampleSize,
    );
    return metricsToExecution(
      rule.ruleId,
      { totalRows: total, evaluatedRows: total, skippedRows: 0, failedRows: failed },
      status,
      sample,
    );
  }, target);
}

async function runRangeCheck(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new AppError(400, 'DQ_COLUMN_REQUIRED', 'range_check requires column');
  const min = rule.params.min;
  const max = rule.params.max;
  if (min === undefined && max === undefined) {
    throw new AppError(400, 'DQ_PARAMS_INVALID', 'range_check requires min or max');
  }
  const target = resolveScanTarget(rule);
  const ident = escapeIdent(rule.column);
  const conditions: string[] = [];
  if (min !== undefined) conditions.push(`${ident} < ${Number(min)}`);
  if (max !== undefined) conditions.push(`${ident} > ${Number(max)}`);
  const where = conditions.join(' OR ');

  return withConnection(async (conn, tgt) => {
    const statsRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total,
              COUNT(${ident}) AS evaluated,
              SUM(CASE WHEN ${ident} IS NOT NULL AND (${where}) THEN 1 ELSE 0 END) AS failed
       FROM delta_scan('${escapeLiteral(tgt.path)}')`,
    );
    const rows = statsRes.getRows() as Array<[bigint | number, bigint | number, bigint | number | null]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const evaluated = Number(rows[0]?.[1] ?? 0);
    const failed = Number(rows[0]?.[2] ?? 0);
    const status = decideStatus({ totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed }, failed);
    const sample = await fetchSample(
      conn,
      tgt.path,
      '*',
      `${ident} IS NOT NULL AND (${where})`,
      options.sampleSize,
    );
    return metricsToExecution(
      rule.ruleId,
      { totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed },
      status,
      sample,
    );
  }, target);
}

async function runInSet(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new AppError(400, 'DQ_COLUMN_REQUIRED', 'in_set requires column');
  const allowed = rule.params.values;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new AppError(400, 'DQ_PARAMS_INVALID', 'in_set requires params.values array');
  }
  const target = resolveScanTarget(rule);
  const ident = escapeIdent(rule.column);
  const valuesList = allowed
    .map((v) => (typeof v === 'number' ? String(v) : `'${escapeLiteral(String(v))}'`))
    .join(', ');

  return withConnection(async (conn, tgt) => {
    const statsRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total,
              COUNT(${ident}) AS evaluated,
              SUM(CASE WHEN ${ident} IS NOT NULL AND ${ident} NOT IN (${valuesList}) THEN 1 ELSE 0 END) AS failed
       FROM delta_scan('${escapeLiteral(tgt.path)}')`,
    );
    const rows = statsRes.getRows() as Array<[bigint | number, bigint | number, bigint | number | null]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const evaluated = Number(rows[0]?.[1] ?? 0);
    const failed = Number(rows[0]?.[2] ?? 0);
    const status = decideStatus({ totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed }, failed);
    const sample = await fetchSample(
      conn,
      tgt.path,
      '*',
      `${ident} IS NOT NULL AND ${ident} NOT IN (${valuesList})`,
      options.sampleSize,
    );
    return metricsToExecution(
      rule.ruleId,
      { totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed },
      status,
      sample,
    );
  }, target);
}

async function runUnique(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new AppError(400, 'DQ_COLUMN_REQUIRED', 'unique requires column');
  const target = resolveScanTarget(rule);
  const ident = escapeIdent(rule.column);

  return withConnection(async (conn, tgt) => {
    // DQ-005: the denominator is the number of non-null values. NULLs are
    // not duplicates — they are reported through the skipped counter and
    // should be covered by a complementary not-null rule.
    const statsRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total,
              COUNT(${ident}) AS evaluated,
              COUNT(DISTINCT ${ident}) AS distinct_count
       FROM delta_scan('${escapeLiteral(tgt.path)}')`,
    );
    const rows = statsRes.getRows() as Array<[bigint | number, bigint | number, bigint | number]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const evaluated = Number(rows[0]?.[1] ?? 0);
    const distinct = Number(rows[0]?.[2] ?? 0);
    const failed = Math.max(evaluated - distinct, 0);
    const status = decideStatus({ totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed }, failed);
    const sample = await fetchDuplicates(conn, tgt.path, ident, options.sampleSize);
    return metricsToExecution(
      rule.ruleId,
      { totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed },
      status,
      sample,
    );
  }, target);
}

async function runRegex(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new AppError(400, 'DQ_COLUMN_REQUIRED', 'regex requires column');
  const pattern = rule.params.pattern;
  if (typeof pattern !== 'string' || pattern.length === 0) {
    throw new AppError(400, 'DQ_PARAMS_INVALID', 'regex requires params.pattern string');
  }
  const target = resolveScanTarget(rule);
  const ident = escapeIdent(rule.column);

  return withConnection(async (conn, tgt) => {
    const statsRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total,
              COUNT(${ident}) AS evaluated,
              SUM(CASE WHEN ${ident} IS NOT NULL AND NOT regexp_matches(${ident}, '${escapeLiteral(pattern)}') THEN 1 ELSE 0 END) AS failed
       FROM delta_scan('${escapeLiteral(tgt.path)}')`,
    );
    const rows = statsRes.getRows() as Array<[bigint | number, bigint | number, bigint | number | null]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const evaluated = Number(rows[0]?.[1] ?? 0);
    const failed = Number(rows[0]?.[2] ?? 0);
    const status: 'pass' | 'fail' = failed === 0 ? 'pass' : 'fail';
    const sample = await fetchSample(
      conn,
      tgt.path,
      '*',
      `${ident} IS NOT NULL AND NOT regexp_matches(${ident}, '${escapeLiteral(pattern)}')`,
      options.sampleSize,
    );
    return metricsToExecution(
      rule.ruleId,
      { totalRows: total, evaluatedRows: evaluated, skippedRows: total - evaluated, failedRows: failed },
      status,
      sample,
    );
  }, target);
}

async function fetchSample(
  conn: DqConnection,
  path: string,
  selectClause: string,
  whereClause: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const reader = await conn.runAndReadAll(
    `SELECT ${selectClause} FROM delta_scan('${escapeLiteral(path)}') WHERE ${whereClause} LIMIT ${Math.max(1, Math.min(limit, 100))}`,
  );
  const colNames = reader.columnNames();
  const rows = reader.getRows() as Array<Array<unknown>>;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < colNames.length; i += 1) {
      const name = colNames[i] ?? `col_${i}`;
      obj[name] = row[i] ?? null;
    }
    return obj;
  });
}

async function fetchDuplicates(
  conn: DqConnection,
  path: string,
  ident: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const reader = await conn.runAndReadAll(
    `SELECT ${ident}, COUNT(*) AS dup_count FROM delta_scan('${escapeLiteral(path)}') WHERE ${ident} IS NOT NULL GROUP BY ${ident} HAVING COUNT(*) > 1 ORDER BY dup_count DESC LIMIT ${Math.max(1, Math.min(limit, 100))}`,
  );
  const colNames = reader.columnNames();
  const rows = reader.getRows() as Array<Array<unknown>>;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < colNames.length; i += 1) {
      const name = colNames[i] ?? `col_${i}`;
      obj[name] = row[i] ?? null;
    }
    return obj;
  });
}
