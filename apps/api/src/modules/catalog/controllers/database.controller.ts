import { DatabaseService } from '../services/database.service';
import { TableRepository } from '../repositories';
import type { DatabaseMeta, TableMeta } from '../types';
import type { TCreateDatabase, TDatabaseParams } from '../schemas';

export const DatabaseController = {
  async list(): Promise<DatabaseMeta[]> {
    return DatabaseService.list();
  },

  async create(input: TCreateDatabase): Promise<DatabaseMeta> {
    return DatabaseService.create(input);
  },

  async get(params: TDatabaseParams): Promise<DatabaseMeta> {
    return DatabaseService.getOrFail(params.db);
  },

  async delete(params: TDatabaseParams): Promise<void> {
    return DatabaseService.delete(params.db);
  },

  async listTables(params: TDatabaseParams): Promise<TableMeta[]> {
    await DatabaseService.getOrFail(params.db);
    const docs = await TableRepository.listByDatabase(params.db);
    return docs
      .map((d) => {
        const tableId = d.tableId as string;
        if (!tableId) return null;
        const [layer, database, name] = tableId.split('.');
        if (!layer || !database || !name) return null;
        if (layer !== 'bronze' && layer !== 'silver' && layer !== 'gold') return null;
        return {
          tableId,
          layer,
          database,
          name,
          fullName: (d.fullName as string) ?? tableId,
          tags: (d.tags as string[]) ?? [],
          partitions: (d.partitions as Array<{ column: string; value: string }>) ?? [],
          columnCount: (d.columnCount as number) ?? 0,
          rowCount: (d.rowCount as number) ?? 0,
          sizeBytes: (d.sizeBytes as number) ?? 0,
          lastModified: (d.lastModified as string | undefined) ?? new Date().toISOString(),
          s3Path: (d.s3Path as string) ?? '',
          deltaHistoryVersion: (d.deltaHistoryVersion as number) ?? 0,
          syncedAt: (d.syncedAt as string | undefined) ?? new Date().toISOString(),
        } as TableMeta;
      })
      .filter((m): m is TableMeta => m !== null);
  },
};