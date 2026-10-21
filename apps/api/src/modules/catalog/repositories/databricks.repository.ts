import { z } from 'zod';
import { env } from '@/config';
import { AppError } from '@/errors';
import { databricksRequest, qualifiedName, readStatement } from '@/lib/infra/databricks/client';
import type { Layer, TableMeta, DatabaseMeta } from '../types';

const columnSchema = z.object({ name: z.string(), type_text: z.string(), nullable: z.boolean(), comment: z.string().optional() });
const tableSchema = z.object({
  name: z.string(), catalog_name: z.string(), schema_name: z.string(), full_name: z.string(),
  table_type: z.string(), data_source_format: z.string().optional(), columns: z.array(columnSchema),
  storage_location: z.string().optional(), comment: z.string().optional(), owner: z.string().optional(),
  created_at: z.number().optional(), updated_at: z.number().optional(),
});
type RemoteTable = z.infer<typeof tableSchema>;
const schemaSchema = z.object({ name: z.string(), catalog_name: z.string(), comment: z.string().optional(), created_at: z.number().optional(), updated_at: z.number().optional() });
const date = (value: number | undefined) => value === undefined ? null : new Date(value).toISOString();
const schemaFor = (layer: Layer) => ({ bronze: env.DATABRICKS_BRONZE_SCHEMA, silver: env.DATABRICKS_SILVER_SCHEMA, gold: env.DATABRICKS_GOLD_SCHEMA })[layer];
const layerFor = (schema: string): Layer | null => schema === schemaFor('bronze') ? 'bronze' : schema === schemaFor('silver') ? 'silver' : schema === schemaFor('gold') ? 'gold' : null;

const cache = new Map<string, { until: number; value: Promise<unknown> }>();
function cached<T>(key: string, schema: z.ZodType<T>, loader: () => Promise<T>): Promise<T> {
  let hit = cache.get(key);
  if (!hit || hit.until < Date.now()) {
    const value = loader();
    hit = { until: Date.now() + 60000, value };
    cache.set(key, hit);
    void value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  }
  return hit.value.then((value) => schema.parse(value));
}

async function pages<T>(path: string, field: string, schema: z.ZodType<T>): Promise<T[]> {
  const items: T[] = [];
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const url = new URL(path, 'https://pagination.invalid');
    if (token) url.searchParams.set('page_token', token);
    const data = z.record(z.unknown()).parse(await databricksRequest(url.pathname + url.search));
    items.push(...z.array(schema).parse(data[field] ?? []));
    token = z.string().optional().parse(data.next_page_token);
    if (token && seen.has(token)) throw new AppError(502, 'DATABRICKS_INVALID_PAGE', 'Databricks repeated a pagination token');
    if (token) seen.add(token);
  } while (token);
  return items;
}

function schemas() {
  return cached('schemas', z.array(schemaSchema), () => pages(`/api/2.1/unity-catalog/schemas?catalog_name=${encodeURIComponent(env.DATABRICKS_CATALOG)}`, 'schemas', schemaSchema));
}
function tables(schema: string) {
  return cached(`tables:${schema}`, z.array(tableSchema), () => pages(`/api/2.1/unity-catalog/tables?catalog_name=${encodeURIComponent(env.DATABRICKS_CATALOG)}&schema_name=${encodeURIComponent(schema)}`, 'tables', tableSchema));
}
async function table(fullName: string): Promise<RemoteTable> {
  qualifiedName(fullName);
  return cached(`table:${fullName}`, tableSchema, async () => tableSchema.parse(await databricksRequest(`/api/2.1/unity-catalog/tables/${encodeURIComponent(fullName)}`)));
}
function meta(value: RemoteTable): TableMeta {
  return {
    tableId: value.full_name, fullName: value.full_name, database: `${value.catalog_name}.${value.schema_name}`,
    name: value.name, layer: layerFor(value.schema_name), catalogName: value.catalog_name,
    schemaName: value.schema_name, format: (value.data_source_format ?? value.table_type).toLowerCase(),
    source: 'databricks', description: value.comment, owner: value.owner,
    tags: [], partitions: [], columnCount: value.columns.length, rowCount: null, sizeBytes: null,
    lastModified: date(value.updated_at ?? value.created_at), s3Path: value.storage_location ?? '',
    deltaHistoryVersion: null, syncedAt: new Date().toISOString(),
  };
}
function layerName(layer: Layer, input: string): string {
  const parts = input.split('.');
  const full = parts.length === 1 ? `${env.DATABRICKS_CATALOG}.${schemaFor(layer)}.${input}`
    : parts.length === 2 ? `${parts[0]}.${schemaFor(layer)}.${parts[1]}` : input;
  qualifiedName(full);
  if (full.split('.')[1] !== schemaFor(layer)) throw new AppError(400, 'INVALID_LAYER_TABLE', 'Table does not belong to this Databricks layer');
  return full;
}
const recordSchema = z.array(z.record(z.unknown()));
async function details(fullName: string) {
  const value = await table(fullName);
  return cached(`details:${fullName}`, z.object({ rows: z.number(), files: z.number().nullable(), bytes: z.number().nullable(), partitionColumns: z.array(z.string()) }), async () => {
    const counts = await readStatement(`SELECT COUNT(*) AS row_count FROM ${qualifiedName(fullName)}`, 1);
    const rows = z.coerce.number().int().nonnegative().safe().parse(counts[0]?.row_count);
    if (value.data_source_format !== 'DELTA' || value.table_type === 'VIEW') return { rows, files: null, bytes: null, partitionColumns: [] };
    const [detail] = await readStatement(`DESCRIBE DETAIL ${qualifiedName(fullName)}`, 1);
    const partitionColumns = typeof detail?.partitionColumns === 'string' ? z.array(z.string()).parse(JSON.parse(detail.partitionColumns)) : [];
    return { rows, files: z.number().parse(detail?.numFiles), bytes: z.number().parse(detail?.sizeInBytes), partitionColumns };
  });
}

export const DatabricksRepository = {
  async databases(): Promise<DatabaseMeta[]> {
    return Promise.all((await schemas()).map(async (schema) => ({
      database: `${schema.catalog_name}.${schema.name}`, catalogName: schema.catalog_name, systemSchema: schema.name === 'information_schema', source: 'databricks' as const,
      description: schema.comment ?? null, layers: layerFor(schema.name) ? [layerFor(schema.name)].filter((layer): layer is Layer => layer !== null) : [],
      tableCount: (await tables(schema.name)).length, createdAt: date(schema.created_at), updatedAt: date(schema.updated_at ?? schema.created_at),
    })));
  },
  async list(query: { database?: string; layer?: Layer; search?: string; offset: number; limit: number }): Promise<TableMeta[]> {
    const selected = (await schemas()).filter((schema) => (!query.database || query.database === `${schema.catalog_name}.${schema.name}` || query.database === schema.catalog_name)
      && (!query.layer || schema.name === schemaFor(query.layer)));
    const all = (await Promise.all(selected.map((schema) => tables(schema.name)))).flat();
    return all.filter((value) => !query.search || value.full_name.toLowerCase().includes(query.search.toLowerCase())).sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(query.offset, query.offset + query.limit).map(meta);
  },
  async get(fullName: string): Promise<TableMeta> {
    const value = await table(fullName);
    const detail = await details(fullName);
    return { ...meta(value), rowCount: detail.rows, sizeBytes: detail.bytes };
  },
  async columns(fullName: string) {
    return (await table(fullName)).columns.map((column) => ({ name: column.name, type: column.type_text, nullable: column.nullable, ...(column.comment ? { description: column.comment } : {}) }));
  },
  async sample(fullName: string, limit: number, version?: number) {
    const bounded = z.number().int().min(1).max(1000).parse(limit);
    const atVersion = version === undefined ? '' : ` VERSION AS OF ${z.number().int().nonnegative().parse(version)}`;
    return readStatement(`SELECT * FROM ${qualifiedName(fullName)}${atVersion} LIMIT ${bounded}`, bounded);
  },
  async history(fullName: string) {
    const value = await table(fullName);
    if (value.data_source_format !== 'DELTA' || value.table_type === 'VIEW') throw new AppError(409, 'DELTA_HISTORY_UNAVAILABLE', 'History is available only for Delta tables');
    return cached(`history:${fullName}`, recordSchema, () => readStatement(`DESCRIBE HISTORY ${qualifiedName(fullName)} LIMIT 50`, 50));
  },
  async layerList(layer: Layer, query: { database?: string; search?: string; offset: number; limit: number; kind?: string }) {
    const all = await this.list({ ...query, database: env.DATABRICKS_CATALOG, layer, offset: 0, limit: 100000 });
    return all.filter((value) => !query.database || query.database === env.DATABRICKS_CATALOG || query.database === value.database)
      .map((value) => ({ table: value.fullName, database: env.DATABRICKS_CATALOG, name: value.name, source: 'databricks' as const }))
      .slice(query.offset, query.offset + query.limit);
  },
  layerName,
  async layerDetail(layer: Layer, input: string) {
    const fullName = layerName(layer, input);
    const value = await this.get(fullName);
    const detail = await details(fullName);
    return { table: fullName, database: env.DATABRICKS_CATALOG, name: value.name, fullName, source: 'databricks' as const,
      s3Path: value.s3Path, columns: await this.columns(fullName), rowCount: detail.rows,
      fileCount: detail.files, sizeBytes: detail.bytes, partitions: detail.partitionColumns.map((column) => ({ column, value: '' })),
      lastModified: value.lastModified, deltaHistoryVersion: null, deltaHistory: [] };
  },
  async layerStats(layer: Layer, input: string) {
    const value = await this.layerDetail(layer, input);
    return { table: value.table, rowCount: value.rowCount, fileCount: value.fileCount, sizeBytes: value.sizeBytes,
      columnCount: value.columns.length, partitionCount: value.partitions.length, lastModified: value.lastModified,
      deltaHistoryVersion: value.deltaHistoryVersion };
  },
  async layerPartitions(layer: Layer, input: string) {
    const value = await details(layerName(layer, input));
    if (value.partitionColumns.length) throw new AppError(409, 'PARTITION_METRICS_UNAVAILABLE', 'Partition value metrics are not provided by this Databricks connection');
    return [];
  },
  async layerHistory(layer: Layer, input: string) {
    return (await this.history(layerName(layer, input))).map((row) => ({
      version: z.coerce.number().int().parse(row.version), timestamp: z.string().parse(row.timestamp), operation: z.string().parse(row.operation),
      user: typeof row.userName === 'string' ? row.userName : '',
    }));
  },
};
