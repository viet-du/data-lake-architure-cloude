import { DuckDBRepository, TableRepository, DatabaseRepository, type TableInput } from '../repositories';
import { TableService } from './table.service';
import { LineageInferenceService } from './lineage-inference.service';
import { logger } from '@/lib/logger';
import type { Layer } from '../types';

export interface SyncResult {
  scanned: number;
  upserted: number;
  failed: number;
  errors: Array<{ tableId: string; message: string }>;
  syncedAt: string;
}

function buildInputFromDelta(
  info: Awaited<ReturnType<typeof DuckDBRepository.getTableInfo>>,
  layer: Layer,
  database: string,
  name: string,
  syncedAt: string,
): TableInput {
  return {
    tableId: TableService.buildTableId(layer, database, name),
    layer,
    database,
    name,
    fullName: `${layer}.${database}.${name}`,
    s3Path: info?.s3Path ?? `s3://lakehouse/${layer}/${database}/${name}`,
    columnCount: info?.columns.length ?? 0,
    rowCount: info?.rowCount ?? 0,
    sizeBytes: info?.sizeBytes ?? 0,
    deltaHistoryVersion: info?.deltaHistoryVersion ?? 0,
    lastModified: info?.lastModified ?? syncedAt,
    syncedAt,
    columns: info?.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
    })) ?? [],
    partitions: info?.partitions ?? [],
    tags: [],
    lineage: { upstreamTableIds: [], downstreamTableIds: [] },
  };
}

export const SyncService = {
  async syncAll(): Promise<SyncResult> {
    const syncedAt = new Date().toISOString();
    const result: SyncResult = { scanned: 0, upserted: 0, failed: 0, errors: [], syncedAt };

    const databases = await DatabaseRepository.list();
    const layers: Layer[] = ['bronze', 'silver', 'gold'];

    for (const db of databases) {
      for (const layer of layers) {
        if (!db.layers.includes(layer)) continue;
        try {
          const tables = await DuckDBRepository.listTablesInDatabase(layer, db.database);
          for (const info of tables) {
            const name = info.s3Path.split('/').pop() ?? '';
            const tableId = TableService.buildTableId(layer, db.database, name);
            result.scanned += 1;
            try {
              const full = await DuckDBRepository.getTableInfo(layer, db.database, name);
              const input = buildInputFromDelta(full ?? info, layer, db.database, name, syncedAt);
              await TableRepository.upsert(input);
              result.upserted += 1;
              try {
                await LineageInferenceService.persistInference(input.tableId);
              } catch (err) {
                logger.warn({ err, tableId: input.tableId }, 'Lineage inference failed during sync');
              }
            } catch (err) {
              result.failed += 1;
              const message = err instanceof Error ? err.message : String(err);
              result.errors.push({ tableId, message });
              logger.error({ err, tableId }, 'Failed to sync table');
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push({ tableId: `${layer}.${db.database}.*`, message });
          logger.error({ err, layer, database: db.database }, 'Failed to list tables in layer');
        }
      }
    }

    return result;
  },

  async syncOne(tableId: string): Promise<{ tableId: string; upserted: boolean; syncedAt: string }> {
    const parsed = TableService.parseTableId(tableId);
    if (!parsed) throw new Error(`Invalid tableId format: ${tableId}`);
    const info = await DuckDBRepository.getTableInfo(parsed.layer, parsed.database, parsed.name);
    if (!info) throw new Error(`Table not found in Delta: ${tableId}`);
    const syncedAt = new Date().toISOString();
    const input = buildInputFromDelta(info, parsed.layer, parsed.database, parsed.name, syncedAt);
    await TableRepository.upsert(input);
    return { tableId, upserted: true, syncedAt };
  },
};