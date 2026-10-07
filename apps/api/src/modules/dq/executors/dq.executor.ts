import { getDuckDB } from '@/lib/infra/duckdb';
import { randomUUID } from 'node:crypto';
import type { DqRule, DqRuleExecution, DqLayer } from '../types';

const LAKEHOUSE_BUCKET = 'lakehouse';

function buildScanPath(layer: DqLayer, table: string, partition?: string): string {
  const cleanedTable = table.replace(/[^a-zA-Z0-9._/-]/g, '');
  const path = `s3://${LAKEHOUSE_BUCKET}/${layer}/${cleanedTable}`;
  if (partition) {
    return `${path}/partition=${partition.replace(/[^a-zA-Z0-9_=-]/g, '')}`;
  }
  return path;
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeIdent(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
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
      return {
        ruleId: rule.ruleId,
        runId,
        status: 'error',
        totalRows: 0,
        failedRows: 0,
        passRate: 0,
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
      return runCustomSql(rule, options);
    default:
      throw new Error(`Unsupported rule type: ${rule.type}`);
  }
}

async function runNullCheck(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new Error('null_check requires column');
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const maxNullPct = Number(rule.params.maxNullPercent ?? 0);
  const ident = escapeIdent(rule.column);
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ${ident} IS NULL THEN 1 ELSE 0 END) AS failed FROM delta_scan('${escapeLiteral(path)}')`,
    );
    const rows = totalRes.getRows() as Array<[bigint | number, bigint | number]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const failed = Number(rows[0]?.[1] ?? 0);
    const passRate = total > 0 ? 1 - failed / total : 1;
    const allowedFailed = Math.floor((total * maxNullPct) / 100);
    const status = failed <= allowedFailed ? 'pass' : 'fail';
    const sample = await fetchSample(conn, path, ident, 'IS NULL', options.sampleSize);
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: failed, passRate, sampleFailures: sample, errorMessage: null };
  } finally {

  }
}

async function runRangeCheck(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new Error('range_check requires column');
  const min = rule.params.min;
  const max = rule.params.max;
  if (min === undefined && max === undefined) throw new Error('range_check requires min or max');
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const ident = escapeIdent(rule.column);
  const conditions: string[] = [];
  if (min !== undefined) conditions.push(`${ident} < ${Number(min)}`);
  if (max !== undefined) conditions.push(`${ident} > ${Number(max)}`);
  const where = conditions.join(' OR ');
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total FROM delta_scan('${escapeLiteral(path)}')`,
    );
    const total = Number((totalRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const failedRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS failed FROM delta_scan('${escapeLiteral(path)}') WHERE ${ident} IS NOT NULL AND (${where})`,
    );
    const failed = Number((failedRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const passRate = total > 0 ? 1 - failed / total : 1;
    const status = failed === 0 ? 'pass' : 'fail';
    const sample = await fetchSample(conn, path, '*', `${ident} IS NOT NULL AND (${where})`, options.sampleSize);
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: failed, passRate, sampleFailures: sample, errorMessage: null };
  } finally {

  }
}

async function runInSet(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new Error('in_set requires column');
  const allowed = rule.params.values;
  if (!Array.isArray(allowed) || allowed.length === 0) throw new Error('in_set requires params.values array');
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const ident = escapeIdent(rule.column);
  const valuesList = allowed
    .map((v) => (typeof v === 'number' ? String(v) : `'${escapeLiteral(String(v))}'`))
    .join(', ');
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total FROM delta_scan('${escapeLiteral(path)}')`,
    );
    const total = Number((totalRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const failedRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS failed FROM delta_scan('${escapeLiteral(path)}') WHERE ${ident} IS NOT NULL AND ${ident} NOT IN (${valuesList})`,
    );
    const failed = Number((failedRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const passRate = total > 0 ? 1 - failed / total : 1;
    const status = failed === 0 ? 'pass' : 'fail';
    const sample = await fetchSample(conn, path, '*', `${ident} IS NOT NULL AND ${ident} NOT IN (${valuesList})`, options.sampleSize);
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: failed, passRate, sampleFailures: sample, errorMessage: null };
  } finally {

  }
}

async function runUnique(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new Error('unique requires column');
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const ident = escapeIdent(rule.column);
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT ${ident}) AS distinct_count FROM delta_scan('${escapeLiteral(path)}') WHERE ${ident} IS NOT NULL`,
    );
    const rows = totalRes.getRows() as Array<[bigint | number, bigint | number]>;
    const total = Number(rows[0]?.[0] ?? 0);
    const distinct = Number(rows[0]?.[1] ?? 0);
    const failed = total - distinct;
    const passRate = total > 0 ? distinct / total : 1;
    const status = failed === 0 ? 'pass' : 'fail';
    const sample = await fetchDuplicates(conn, path, ident, options.sampleSize);
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: failed, passRate, sampleFailures: sample, errorMessage: null };
  } finally {

  }
}

async function runRegex(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  if (!rule.column) throw new Error('regex requires column');
  const pattern = rule.params.pattern;
  if (typeof pattern !== 'string' || pattern.length === 0) throw new Error('regex requires params.pattern string');
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const ident = escapeIdent(rule.column);
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const totalRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS total FROM delta_scan('${escapeLiteral(path)}')`,
    );
    const total = Number((totalRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const failedRes = await conn.runAndReadAll(
      `SELECT COUNT(*) AS failed FROM delta_scan('${escapeLiteral(path)}') WHERE ${ident} IS NOT NULL AND NOT regexp_matches(${ident}, '${escapeLiteral(pattern)}')`,
    );
    const failed = Number((failedRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const passRate = total > 0 ? 1 - failed / total : 1;
    const status = failed === 0 ? 'pass' : 'fail';
    const sample = await fetchSample(conn, path, '*', `${ident} IS NOT NULL AND NOT regexp_matches(${ident}, '${escapeLiteral(pattern)}')`, options.sampleSize);
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: failed, passRate, sampleFailures: sample, errorMessage: null };
  } finally {

  }
}

async function runCustomSql(
  rule: Pick<DqRule, 'ruleId' | 'layer' | 'table' | 'column' | 'params'>,
  options: { partition?: string; limit: number; sampleSize: number },
): Promise<Omit<DqRuleExecution, 'durationMs' | 'executedAt' | 'runId'>> {
  const sql = rule.params.sql;
  if (typeof sql !== 'string' || sql.length === 0) throw new Error('custom_sql requires params.sql string');
  if (/\b(DROP|DELETE|UPDATE|INSERT|CREATE|TRUNCATE|ALTER)\b/i.test(sql)) {
    throw new Error('custom_sql only allows SELECT queries');
  }
  const path = buildScanPath(rule.layer, rule.table, options.partition);
  const instance = await getDuckDB();
  const conn = await instance.connect();
  try {
    const replacedSql = sql.replace(/\$\{table\}/g, `delta_scan('${escapeLiteral(path)}')`);
    const totalRes = await conn.runAndReadAll(`SELECT COUNT(*) AS total FROM ${replacedSql}`);
    const total = Number((totalRes.getRows() as Array<[bigint | number]>)[0]?.[0] ?? 0);
    const status = total === 0 ? 'pass' : 'fail';
    return { ruleId: rule.ruleId, status, totalRows: total, failedRows: total, passRate: total === 0 ? 1 : 0, sampleFailures: [], errorMessage: null };
  } finally {

  }
}

async function fetchSample(
  conn: Awaited<ReturnType<Awaited<ReturnType<typeof getDuckDB>>['connect']>>,
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
  conn: Awaited<ReturnType<Awaited<ReturnType<typeof getDuckDB>>['connect']>>,
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