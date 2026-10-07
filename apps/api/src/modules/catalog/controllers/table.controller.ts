import { TableService } from '../services/table.service';
import { LineageService } from '../services/lineage.service';
import { LineageInferenceService } from '../services/lineage-inference.service';
import { SyncService } from '../services/sync.service';
import type {
  TableMeta,
  LineageGraph,
  TableStats,
  ColumnMeta,
} from '../types';
import type {
  TTableIdParams,
  TTableLayerQuery,
  TUpdateTableMetadata,
  TSampleQuery,
} from '../schemas';

export const TableController = {
  async list(query: TTableLayerQuery): Promise<TableMeta[]> {
    return TableService.list(query);
  },

  async get(params: TTableIdParams): Promise<TableMeta> {
    return TableService.getOrFail(params);
  },

  async getSchema(params: TTableIdParams): Promise<{ tableId: string; columns: ColumnMeta[] }> {
    return TableService.getSchema(params.tableId);
  },

  async getLineage(params: TTableIdParams): Promise<LineageGraph & { inferred: boolean }> {
    const existing = await LineageService.getLineage(params.tableId);
    const isEmpty = existing.upstream.length === 0 && existing.downstream.length === 0;
    if (isEmpty) {
      const inferred = await LineageInferenceService.inferFromName(params.tableId);
      return {
        tableId: existing.tableId,
        upstream: inferred.upstream,
        downstream: inferred.downstream,
        inferred: true,
      };
    }
    return { ...existing, inferred: false };
  },

  async getStats(params: TTableIdParams): Promise<TableStats> {
    return TableService.getStats(params.tableId);
  },

  async getSample(params: TTableIdParams, query: TSampleQuery): Promise<Array<Record<string, unknown>>> {
    return TableService.getSample(params.tableId, query);
  },

  async updateMetadata(
    params: TTableIdParams,
    patch: TUpdateTableMetadata,
  ): Promise<TableMeta> {
    return TableService.updateMetadata(params.tableId, patch);
  },

  async delete(params: TTableIdParams): Promise<void> {
    return TableService.delete(params.tableId);
  },

  async sync(params: TTableIdParams): Promise<{ tableId: string; upserted: boolean; syncedAt: string }> {
    return SyncService.syncOne(params.tableId);
  },

  async inferLineage(params: TTableIdParams): Promise<{ tableId: string; upstream: unknown[]; downstream: unknown[] }> {
    const result = await LineageInferenceService.persistInference(params.tableId);
    return { tableId: params.tableId, upstream: result.upstream, downstream: result.downstream };
  },
};