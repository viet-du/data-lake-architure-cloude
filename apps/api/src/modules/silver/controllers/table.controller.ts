import { SilverTableService } from '../services/table.service';
import type {
  SilverTable,
  SilverStats,
  SilverHistoryEntry,
  SilverPartition,
  TimeTravelData,
  DiffResult,
} from '../types';
import type { ColumnMeta } from '@/modules/catalog/types';
import type {
  TTableParams,
  TTableListQuery,
  TSampleQuery,
  TTimeTravelParams,
  TTimeTravelQuery,
  TDiffParams,
} from '../schemas';

export const SilverTableController = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string }[]> {
    return SilverTableService.list(query);
  },

  async get(params: TTableParams): Promise<SilverTable> {
    return SilverTableService.getOrFail(params);
  },

  async sample(params: TTableParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    return SilverTableService.sample(params, query);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    return SilverTableService.schema(params);
  },

  async partitions(params: TTableParams): Promise<SilverPartition[]> {
    return SilverTableService.partitions(params);
  },

  async history(params: TTableParams): Promise<SilverHistoryEntry[]> {
    return SilverTableService.history(params);
  },

  async stats(params: TTableParams): Promise<SilverStats> {
    return SilverTableService.stats(params);
  },

  async timeTravel(params: TTimeTravelParams, query: TTimeTravelQuery): Promise<TimeTravelData> {
    return SilverTableService.timeTravel(params, query);
  },

  async diff(params: TDiffParams): Promise<DiffResult> {
    return SilverTableService.diff(params);
  },
};