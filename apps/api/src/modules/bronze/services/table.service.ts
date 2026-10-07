import { NotFoundError } from '@/errors';
import { BronzeDuckDBRepository } from '../repositories/duckdb.repository';
import type { BronzePartition, BronzeStats, BronzeTable, BronzeHistoryEntry } from '../types';
import type { ColumnMeta } from '@/modules/catalog/types';
import type {
  TTableParams,
  TTableListQuery,
  TSampleQuery,
  TPartitionDateParams,
  TVacuumBody,
} from '../schemas';

function parseTableParam(table: string): { database: string; name: string } | null {
  const parts = table.split('.');
  if (parts.length !== 2) return null;
  const [database, name] = parts;
  if (!database || !name) return null;
  return { database, name };
}

export const BronzeTableService = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string }[]> {
    const tableIds = await BronzeDuckDBRepository.listTables({
      ...(query.database ? { database: query.database } : {}),
      ...(query.search ? { search: query.search } : {}),
    });
    const all = tableIds.map((id) => {
      const [database, name] = id.split('.');
      return { table: id, database: database ?? '', name: name ?? '' };
    });
    return all.slice(query.offset, query.offset + query.limit);
  },

  async getOrFail(params: TTableParams): Promise<BronzeTable> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const [columns, rowCount, fileCount, sizeBytes, hist, partitions] = await Promise.all([
      BronzeDuckDBRepository.describe(parsed.database, parsed.name),
      BronzeDuckDBRepository.count(parsed.database, parsed.name),
      BronzeDuckDBRepository.fileCount(parsed.database, parsed.name),
      BronzeDuckDBRepository.sizeBytes(parsed.database, parsed.name),
      BronzeDuckDBRepository.history(parsed.database, parsed.name),
      BronzeDuckDBRepository.partitionsDetail(parsed.database, parsed.name),
    ]);
    return {
      table: params.table,
      database: parsed.database,
      name: parsed.name,
      fullName: `bronze.${parsed.database}.${parsed.name}`,
      s3Path: `s3://lakehouse/bronze/${parsed.database}/${parsed.name}`,
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
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return BronzeDuckDBRepository.sample(parsed.database, parsed.name, query.limit);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const columns = await BronzeDuckDBRepository.describe(parsed.database, parsed.name);
    return { table: params.table, columns };
  },

  async history(params: TTableParams): Promise<BronzeHistoryEntry[]> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return BronzeDuckDBRepository.history(parsed.database, parsed.name);
  },

  async partitions(params: TTableParams): Promise<BronzePartition[]> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return BronzeDuckDBRepository.partitions(parsed.database, parsed.name);
  },

  async stats(params: TTableParams): Promise<BronzeStats> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    return BronzeDuckDBRepository.stats(parsed.database, parsed.name);
  },

  async vacuum(params: TTableParams, body: TVacuumBody): Promise<{
    table: string;
    filesRemoved: number;
    bytesReclaimed: number;
    dryRun: boolean;
    retentionDays: number;
  }> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const result = await BronzeDuckDBRepository.vacuum(parsed.database, parsed.name, body.retentionDays, body.dryRun);
    return { table: params.table, ...result, retentionDays: body.retentionDays };
  },

  async deletePartition(params: TPartitionDateParams): Promise<{ table: string; partition: string; rowsDeleted: number }> {
    const parsed = parseTableParam(params.table);
    if (!parsed) throw new NotFoundError('Table', params.table);
    const result = await BronzeDuckDBRepository.deletePartition(parsed.database, parsed.name, params.date);
    return { table: params.table, partition: result.partition, rowsDeleted: result.rowsDeleted };
  },
};

export { parseTableParam };