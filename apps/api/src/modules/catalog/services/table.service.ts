import { usesDatabricks, remoteReadOnly } from '@/lib/infra/databricks/client';
import { DatabricksRepository } from '../repositories/databricks.repository';
import { NotFoundError } from '@/errors';
import { DuckDBRepository, TableRepository, type DeltaTableInfo } from '../repositories';
import type { ColumnMeta, TableMeta, TableStats, Layer } from '../types';
import type {
  TTableIdParams,
  TTableLayerQuery,
  TUpdateTableMetadata,
  TSampleQuery,
} from '../schemas';
import type { TCatalogProvider } from '../schemas/table.schema';

const STORAGE_BUCKET = 'lakehouse';

/**
 * Resolve the catalog provider for one request.
 *
 * MASTER PLAN §02.2: Databricks and the local Delta lakehouse are two
 * distinct stores. The catalog must therefore address exactly one of them
 * per request — never a silent merge, which would make the table list
 * ambiguous and the "table not found" answer depend on which store happened
 * to hold the name.
 *
 * An explicit provider always wins; otherwise the configured
 * `LAKEHOUSE_DATA_SOURCE` decides.
 */
function catalogProvider(explicit?: TCatalogProvider): 'databricks' | 'local' {
  if (explicit) return explicit;
  return usesDatabricks() ? 'databricks' : 'local';
}

function buildTableId(layer: Layer, database: string, name: string): string {
  return `${layer}.${database}.${name}`;
}

function parseTableId(tableId: string): { layer: Layer; database: string; name: string } | null {
  const parts = tableId.split('.');
  if (parts.length !== 3) return null;
  const [layer, database, name] = parts;
  if (layer === 'bronze' || layer === 'silver' || layer === 'gold') {
    if (!database || !name) return null;
    return { layer, database, name };
  }
  return null;
}

function toTableMeta(doc: Record<string, unknown> | null): TableMeta | null {
  if (!doc) return null;
  const tableId = doc.tableId as string;
  if (!tableId) return null;
  const parsed = parseTableId(tableId);
  if (!parsed) return null;
  return {
    tableId,
    layer: parsed.layer,
    database: parsed.database,
    name: parsed.name,
    fullName: (doc.fullName as string) ?? tableId,
    provider: 'local',
    source: 'local',
    description: (doc.description as string | undefined) ?? undefined,
    owner: (doc.owner as string | undefined) ?? undefined,
    tags: (doc.tags as string[]) ?? [],
    partitions: (doc.partitions as Array<{ column: string; value: string }>) ?? [],
    columnCount: (doc.columnCount as number) ?? 0,
    rowCount: (doc.rowCount as number) ?? 0,
    sizeBytes: (doc.sizeBytes as number) ?? 0,
    lastModified: (doc.lastModified as string | undefined) ?? new Date().toISOString(),
    s3Path: (doc.s3Path as string) ?? '',
    deltaHistoryVersion: (doc.deltaHistoryVersion as number) ?? 0,
    syncedAt: (doc.syncedAt as string | undefined) ?? new Date().toISOString(),
  };
}

function deltaToTableMeta(info: DeltaTableInfo, layer: Layer, database: string, name: string): TableMeta {
  return {
    tableId: buildTableId(layer, database, name),
    layer,
    database,
    name,
    fullName: `${layer}.${database}.${name}`,
    provider: 'local',
    source: 'local',
    tags: [],
    partitions: info.partitions,
    columnCount: info.columns.length,
    rowCount: info.rowCount,
    sizeBytes: info.sizeBytes,
    lastModified: info.lastModified ?? new Date().toISOString(),
    s3Path: info.s3Path,
    deltaHistoryVersion: info.deltaHistoryVersion,
    syncedAt: new Date().toISOString(),
  };
}

export const TableService = {
  async list(query: TTableLayerQuery): Promise<TableMeta[]> {
    // The provider is an explicit input: MASTER PLAN §02.2 forbids merging
    // two catalogs into one ambiguous list, so a request addresses exactly
    // one store. `undefined` keeps the configured default.
    if (catalogProvider(query.provider) === 'databricks') return DatabricksRepository.list(query);
    const filter = {
      limit: query.limit,
      offset: query.offset,
      ...(query.layer ? { layer: query.layer as Layer } : {}),
      ...(query.database ? { database: query.database } : {}),
      ...(query.search ? { search: query.search } : {}),
    };
    const docs = await TableRepository.list(filter);
    return docs.map((d) => toTableMeta(d)).filter((m): m is TableMeta => m !== null);
  },

  async getOrFail(params: TTableIdParams): Promise<TableMeta> {
    if (catalogProvider(params.provider) === 'databricks') return DatabricksRepository.get(params.tableId);
    const doc = await TableRepository.findById(params.tableId);
    if (!doc) {
      const parsed = parseTableId(params.tableId);
      if (!parsed) throw new NotFoundError('Table', params.tableId);
      const info = await DuckDBRepository.getTableInfo(parsed.layer, parsed.database, parsed.name);
      if (!info) throw new NotFoundError('Table', params.tableId);
      return deltaToTableMeta(info, parsed.layer, parsed.database, parsed.name);
    }
    const meta = toTableMeta(doc);
    if (!meta) throw new NotFoundError('Table', params.tableId);
    return meta;
  },

  async getSchema(
    tableId: string,
    provider?: TCatalogProvider,
  ): Promise<{ tableId: string; columns: ColumnMeta[] }> {
    if (catalogProvider(provider) === 'databricks') {
      return { tableId, columns: await DatabricksRepository.columns(tableId) };
    }
    const parsed = parseTableId(tableId);
    if (!parsed) throw new NotFoundError('Table', tableId);
    const info = await DuckDBRepository.getTableInfo(parsed.layer, parsed.database, parsed.name);
    if (!info) throw new NotFoundError('Table', tableId);
    return { tableId, columns: info.columns };
  },

  async getStats(tableId: string, provider?: TCatalogProvider): Promise<TableStats> {
    const meta = await this.getOrFail({ tableId, provider });
    return {
      tableId: meta.tableId,
      rowCount: meta.rowCount,
      sizeBytes: meta.sizeBytes,
      columnCount: meta.columnCount,
      partitionCount: meta.partitions.length,
      lastModified: meta.lastModified,
      deltaHistoryVersion: meta.deltaHistoryVersion,
    };
  },

  async getSample(
    tableId: string,
    query: TSampleQuery,
    provider?: TCatalogProvider,
  ): Promise<Array<Record<string, unknown>>> {
    if (catalogProvider(provider) === 'databricks') {
      return DatabricksRepository.sample(tableId, query.limit);
    }
    const parsed = parseTableId(tableId);
    if (!parsed) throw new NotFoundError('Table', tableId);
    return DuckDBRepository.getTableSample(parsed.layer, parsed.database, parsed.name, query.limit);
  },

  async updateMetadata(
    tableId: string,
    patch: TUpdateTableMetadata,
  ): Promise<TableMeta> {
    remoteReadOnly();
    const exists = await TableRepository.findById(tableId);
    if (!exists) throw new NotFoundError('Table', tableId);
    const repoPatch: { description?: string; owner?: string; tags?: string[] } = {};
    if (patch.description !== undefined) repoPatch.description = patch.description;
    if (patch.owner !== undefined) repoPatch.owner = patch.owner;
    if (patch.tags !== undefined) repoPatch.tags = patch.tags;
    const updated = await TableRepository.updateMetadata(tableId, repoPatch);
    const meta = toTableMeta(updated);
    if (!meta) throw new NotFoundError('Table', tableId);
    return meta;
  },

  async delete(tableId: string): Promise<void> {
    remoteReadOnly();
    const exists = await TableRepository.findById(tableId);
    if (!exists) throw new NotFoundError('Table', tableId);
    await TableRepository.delete(tableId);
  },

  buildTableId,
  parseTableId,
};

export { STORAGE_BUCKET };