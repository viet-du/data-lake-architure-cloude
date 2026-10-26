import { z } from 'zod';
import { env } from '@/config';
import { AppError } from '@/errors';

/**
 * The default **read** source.
 *
 * MASTER PLAN §02.2: "Databricks and MinIO are not automatically one unified
 * data store." This flag only selects where the control plane *reads* a
 * dataset from by default.
 */
export const usesDatabricks = () => env.LAKEHOUSE_DATA_SOURCE === 'databricks';

/**
 * The **execution target** for ETL/ELT mutations.
 *
 * MASTER PLAN §02.2 / §09 (`executionTarget`): the target where a pipeline
 * actually runs is a separate decision from the read source.
 *
 * - `local_delta_minio` — Spark jobs write Delta tables into MinIO. This is
 *   the only target that is actually provisioned in this deployment.
 * - `databricks_uc` — reserved for a remote Databricks Jobs/Workflows
 *   pipeline. It is **not** implemented here, so every mutation against it
 *   is rejected instead of silently falling back to MinIO.
 */
export const executionTarget = () => env.LAKEHOUSE_EXECUTION_TARGET;

export function identifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new AppError(400, 'INVALID_IDENTIFIER', 'Invalid Databricks identifier');
  return `\`${value}\``;
}

export function qualifiedName(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== env.DATABRICKS_CATALOG) {
    throw new AppError(400, 'INVALID_TABLE', 'Use a table from the configured Databricks catalog');
  }
  return parts.map(identifier).join('.');
}

export async function databricksRequest(path: string, body?: unknown, timeoutMs = 15000): Promise<unknown> {
  if (!env.DATABRICKS_HOST || !env.DATABRICKS_TOKEN) throw new AppError(503, 'DATABRICKS_NOT_CONFIGURED', 'Databricks is not configured');
  if (!path.startsWith('/api/') || path.includes('://')) throw new AppError(400, 'INVALID_DATABRICKS_PATH', 'Invalid Databricks API path');
  try {
    const response = await fetch(new URL(path, env.DATABRICKS_HOST), {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${env.DATABRICKS_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? response.status : response.status === 404 ? 404 : 503;
      throw new AppError(status, 'DATABRICKS_REQUEST_FAILED', `Databricks request failed (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'DATABRICKS_UNREACHABLE', 'Databricks is unavailable or the request timed out');
  }
}

const statementSchema = z.object({
  statement_id: z.string(), status: z.object({ state: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'CLOSED']),
    sql_state: z.string().optional(), error: z.object({ error_code: z.string(), message: z.string().optional() }).optional(),
  }),
  manifest: z.object({ truncated: z.boolean().optional(), schema: z.object({ columns: z.array(z.object({ name: z.string(), type_name: z.string() })) }) }).optional(),
  result: z.object({ data_array: z.array(z.array(z.string().nullable())).optional(), next_chunk_index: z.number().optional() }).optional(),
});

export async function readStatement(statement: string, rowLimit = 1000): Promise<Array<Record<string, unknown>>> {
  if (!/^(SELECT|DESCRIBE\s+(DETAIL|HISTORY))\s/i.test(statement.trim()) || /;|--|\/\*/.test(statement)) {
    throw new AppError(400, 'READ_ONLY_QUERY_REQUIRED', 'Only a single read-only SELECT or DESCRIBE statement is supported');
  }
  const deadline = Date.now() + 25000;
  let result = statementSchema.parse(await databricksRequest('/api/2.0/sql/statements', {
    warehouse_id: env.DATABRICKS_WAREHOUSE_ID, statement, catalog: env.DATABRICKS_CATALOG,
    disposition: 'INLINE', format: 'JSON_ARRAY', wait_timeout: '0s', on_wait_timeout: 'CONTINUE', row_limit: rowLimit,
  }));
  while (['PENDING', 'RUNNING'].includes(result.status.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    result = statementSchema.parse(await databricksRequest(`/api/2.0/sql/statements/${encodeURIComponent(result.statement_id)}`, undefined, Math.min(15000, remaining)));
  }
  if (['PENDING', 'RUNNING'].includes(result.status.state)) {
    await databricksRequest(`/api/2.0/sql/statements/${encodeURIComponent(result.statement_id)}/cancel`, {}, 3000);
    throw new AppError(504, 'DATABRICKS_QUERY_TIMEOUT', 'Databricks query timed out; retry when the warehouse is ready');
  }
  if (result.status.state === 'CANCELED') throw new AppError(504, 'DATABRICKS_QUERY_TIMEOUT', 'Databricks query was canceled; retry when the warehouse is ready');
  if (result.status.sql_state === '42501' || /INSUFFICIENT_PERMISSIONS|PERMISSION_DENIED/.test(result.status.error?.message ?? '')) {
    throw new AppError(403, 'DATABRICKS_PERMISSION_DENIED', 'Databricks requires USE CATALOG, USE SCHEMA and SELECT permissions for this table');
  }
  if (result.status.state !== 'SUCCEEDED' || !result.manifest) throw new AppError(503, 'DATABRICKS_QUERY_FAILED', 'Databricks could not complete the read query; check warehouse and SELECT permissions');
  if (result.manifest.truncated || result.result?.next_chunk_index !== undefined) throw new AppError(502, 'DATABRICKS_RESULT_TOO_LARGE', 'Query result exceeds the preview limit; select fewer rows or columns');
  const columns = result.manifest.schema.columns;
  return (result.result?.data_array ?? []).map((row) => Object.fromEntries(columns.map((column, index) => {
    const value = row[index] ?? null;
    if (value === null) return [column.name, null];
    if (column.type_name === 'BOOLEAN') return [column.name, value === 'true'];
    if (['BYTE', 'SHORT', 'INT', 'LONG', 'FLOAT', 'DOUBLE'].includes(column.type_name)) {
      const number = Number(value);
      if (Number.isFinite(number) && (!['LONG'].includes(column.type_name) || Number.isSafeInteger(number))) return [column.name, number];
    }
    return [column.name, value];
  })));
}

/**
 * Guard a mutation against a read-only execution target.
 *
 * MASTER PLAN §02.2: the read source and the execution target are separate
 * settings. A deployment may browse a Databricks catalog while running its
 * ETL pipeline on the local Delta lakehouse, so this guard is driven by
 * `LAKEHOUSE_EXECUTION_TARGET` — not by the read source.
 *
 * The Databricks execution target is reserved for a remote Databricks
 * Jobs/Workflows pipeline that is not implemented yet. Rejecting it here is
 * what prevents a "Databricks" action from silently writing into MinIO.
 */
export function remoteReadOnly(): void {
  if (executionTarget() === 'databricks_uc') {
    throw new AppError(
      409,
      'DATABRICKS_READ_ONLY',
      'The Databricks execution target is read-only in this deployment; ' +
        'it supports browsing and read-only queries, while ETL/ELT mutations ' +
        'run on the local Delta lakehouse (LAKEHOUSE_EXECUTION_TARGET=local_delta_minio).',
    );
  }
}
