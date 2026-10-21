import { usesDatabricks, remoteReadOnly } from '@/lib/infra/databricks/client';
import { DatabricksRepository } from '@/modules/catalog/repositories/databricks.repository';
import { NotFoundError } from '@/errors';
import { SilverDuckDBRepository } from '../repositories/duckdb.repository';
import type { ColumnMeta } from '@/modules/catalog/types';
import type {
  SilverTable,
  SilverStats,
  SilverHistoryEntry,
  SilverPartition,
  TimeTravelData,
  DiffResult,
} from '../types';
import type {
  TTableParams,
  TTableListQuery,
  TSampleQuery,
  TTimeTravelParams,
  TTimeTravelQuery,
  TDiffParams,
} from '../schemas';

function parseTableParam(table: string): { database: string; name: string } | null {
  const parts = table.split('.');
  if (parts.length !== 2) return null;
  const [database, name] = parts;
  if (!database || !name) return null;
  return { database, name };
}

export const SilverTableService = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string }[]> {
    if (usesDatabricks()) return DatabricksRepository.layerList('silver', query);
    const tableIds = await SilverDuckDBRepository.listTables({
      ...(query.database ? { database: query.database } : {}),
      ...(query.search ? { search: query.search } : {}),
    });
    const all = tableIds.map((id) => {
      const [database, name] = id.split('.');
      return { table: id, database: database ?? '', name: name ?? '' };
    });
    return all.slice(query.offset, query.offset + query.limit);
  },

  async getOrFail(params: TTableParams): Promise<SilverTable> {
    if (usesDatabricks()) return DatabricksRepository.layerDetail('silver', params.table);
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const [columns, rowCount, fileCount, sizeBytes, hist, partitions] = await Promise.all([
      SilverDuckDBRepository.describe(parsed.database, parsed.name),
      SilverDuckDBRepository.count(parsed.database, parsed.name),
      SilverDuckDBRepository.fileCount(parsed.database, parsed.name),
      SilverDuckDBRepository.sizeBytes(parsed.database, parsed.name),
      SilverDuckDBRepository.history(parsed.database, parsed.name),
      SilverDuckDBRepository.partitionsDetail(parsed.database, parsed.name),
    ]);
    return {
      table: params.table,
      database: parsed.database,
      name: parsed.name,
      fullName: `silver.${parsed.database}.${parsed.name}`,
      s3Path: `s3://lakehouse/silver/${parsed.database}/${parsed.name}`,
      columns,
      partitions,
      rowCount,
      fileCount,
      sizeBytes,
      lastModified: new Date().toISOString(),
      deltaHistoryVersion: hist[0]?.version ?? 0,
      deltaHistory: hist,
    };
  },

  async sample(params: TTableParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    if (usesDatabricks()) return DatabricksRepository.sample(DatabricksRepository.layerName('silver', params.table), query.limit);
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.sample(parsed.database, parsed.name, query.limit);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    if (usesDatabricks()) return { table: params.table, columns: await DatabricksRepository.columns(DatabricksRepository.layerName('silver', params.table)) };
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const columns = await SilverDuckDBRepository.describe(parsed.database, parsed.name);
    return { table: params.table, columns };
  },

  async history(params: TTableParams): Promise<SilverHistoryEntry[]> {
    if (usesDatabricks()) return DatabricksRepository.layerHistory('silver', params.table);
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.history(parsed.database, parsed.name);
  },

  async partitions(params: TTableParams): Promise<SilverPartition[]> {
    if (usesDatabricks()) return DatabricksRepository.layerPartitions('silver', params.table);
    remoteReadOnly();
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.partitions(parsed.database, parsed.name);
  },

  async stats(params: TTableParams): Promise<SilverStats> {
    if (usesDatabricks()) return DatabricksRepository.layerStats('silver', params.table);
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.stats(parsed.database, parsed.name);
  },

  async timeTravel(params: TTimeTravelParams, query: TTimeTravelQuery): Promise<TimeTravelData> {
    remoteReadOnly();
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.timeTravel(parsed.database, parsed.name, params.version, query.limit);
  },

  async diff(params: TDiffParams): Promise<DiffResult> {
    remoteReadOnly();
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return SilverDuckDBRepository.diff(parsed.database, parsed.name, params.v1, params.v2);
  },
};

export { parseTableParam as parseSilverTableParam };