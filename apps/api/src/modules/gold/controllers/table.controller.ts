import { GoldTableService } from '../services/table.service';
import type {
  GoldTable,
  GoldStats,
  GoldHistoryEntry,
  GoldLineageGraph,
} from '../types';
import type { ColumnMeta } from '@/modules/catalog/types';
import type { TTableParams, TTableListQuery, TSampleQuery } from '../schemas';

export const GoldTableController = {
  async list(query: TTableListQuery): Promise<{ table: string; database: string; name: string; kind: 'fact' | 'dimension' | 'metric' }[]> {
    return GoldTableService.list(query);
  },

  async get(params: TTableParams): Promise<GoldTable> {
    return GoldTableService.getOrFail(params);
  },

  async sample(params: TTableParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    return GoldTableService.sample(params, query);
  },

  async schema(params: TTableParams): Promise<{ table: string; columns: ColumnMeta[] }> {
    return GoldTableService.schema(params);
  },

  async history(params: TTableParams): Promise<GoldHistoryEntry[]> {
    return GoldTableService.history(params);
  },

  async stats(params: TTableParams): Promise<GoldStats> {
    return GoldTableService.stats(params);
  },

  async lineage(params: TTableParams): Promise<GoldLineageGraph> {
    return GoldTableService.lineage(params);
  },
};