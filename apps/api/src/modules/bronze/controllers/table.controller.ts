import { BronzeTableService } from '../services/table.service';
import type { BronzeTable, BronzeStats, BronzeHistoryEntry, BronzePartition } from '../types';
import type { ColumnMeta } from '@/modules/catalog/types';
import type {
  TTableParams,
  TTableListQuery,
  TSampleQuery,
  TPartitionDateParams,
  TVacuumBody,
} from '../schemas';

export const BronzeTableController = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string }[]> {
    return BronzeTableService.list(query);
  },

  async get(params: TTableParams): Promise<BronzeTable> {
    return BronzeTableService.getOrFail(params);
  },

  async sample(params: TTableParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    return BronzeTableService.sample(params, query);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    return BronzeTableService.schema(params);
  },

  async partitions(params: TTableParams): Promise<BronzePartition[]> {
    return BronzeTableService.partitions(params);
  },

  async history(params: TTableParams): Promise<BronzeHistoryEntry[]> {
    return BronzeTableService.history(params);
  },

  async stats(params: TTableParams): Promise<BronzeStats> {
    return BronzeTableService.stats(params);
  },

  async vacuum(params: TTableParams, body: TVacuumBody): Promise<{
    table: string;
    filesRemoved: number;
    bytesReclaimed: number;
    dryRun: boolean;
    retentionDays: number;
  }> {
    return BronzeTableService.vacuum(params, body);
  },

  async deletePartition(params: TPartitionDateParams): Promise<{ table: string; partition: string; rowsDeleted: number }> {
    return BronzeTableService.deletePartition(params);
  },
};