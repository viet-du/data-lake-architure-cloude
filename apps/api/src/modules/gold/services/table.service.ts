import { NotFoundError } from '@/errors';
import { GoldDuckDBRepository, inferTableKind } from '../repositories/duckdb.repository';
import type { ColumnMeta } from '@/modules/catalog/types';
import type {
  GoldTable,
  GoldStats,
  GoldHistoryEntry,
  GoldLineageGraph,
} from '../types';
import type {
  TTableParams,
  TTableListQuery,
  TSampleQuery,
} from '../schemas';

function parseTableParam(table: string): { database: string; name: string } | null {
  const parts = table.split('.');
  if (parts.length !== 2) return null;
  const [database, name] = parts;
  if (!database || !name) return null;
  return { database, name };
}

export const GoldTableService = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string; kind: 'fact' | 'dimension' | 'metric' }[]> {
    const tableIds = await GoldDuckDBRepository.listTables({
      ...(query.database ? { database: query.database } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
    });
    const all = tableIds.map((id) => {
      const [database, name] = id.split('.');
      return {
        table: id,
        database: database ?? '',
        name: name ?? '',
        kind: inferTableKind(name ?? ''),
      };
    });
    return all.slice(query.offset, query.offset + query.limit);
  },

  async getOrFail(params: TTableParams): Promise<GoldTable> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const [columns, rowCount, fileCount, sizeBytes, hist, partitions, lastRefresh] = await Promise.all([
      GoldDuckDBRepository.describe(parsed.database, parsed.name),
      GoldDuckDBRepository.count(parsed.database, parsed.name),
      GoldDuckDBRepository.fileCount(parsed.database, parsed.name),
      GoldDuckDBRepository.sizeBytes(parsed.database, parsed.name),
      GoldDuckDBRepository.history(parsed.database, parsed.name),
      GoldDuckDBRepository.partitionsDetail(parsed.database, parsed.name),
      GoldDuckDBRepository.lastRefreshAt(parsed.database, parsed.name),
    ]);
    return {
      table: params.table,
      database: parsed.database,
      name: parsed.name,
      fullName: `gold.${parsed.database}.${parsed.name}`,
      s3Path: `s3://lakehouse/gold/${parsed.database}/${parsed.name}`,
      kind: inferTableKind(parsed.name),
      columns,
      partitions,
      rowCount,
      fileCount,
      sizeBytes,
      lastModified: new Date().toISOString(),
      lastRefreshAt: lastRefresh,
      deltaHistoryVersion: hist[0]?.version ?? 0,
      deltaHistory: hist,
    };
  },

  async sample(params: TTableParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return GoldDuckDBRepository.sample(parsed.database, parsed.name, query.limit);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const columns = await GoldDuckDBRepository.describe(parsed.database, parsed.name);
    return { table: params.table, columns };
  },

  async history(params: TTableParams): Promise<GoldHistoryEntry[]> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return GoldDuckDBRepository.history(parsed.database, parsed.name);
  },

  async stats(params: TTableParams): Promise<GoldStats> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return GoldDuckDBRepository.stats(parsed.database, parsed.name);
  },

  async lineage(params: TTableParams): Promise<GoldLineageGraph> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return GoldDuckDBRepository.lineage(parsed.database, parsed.name);
  },
};

export { parseTableParam as parseGoldTableParam };