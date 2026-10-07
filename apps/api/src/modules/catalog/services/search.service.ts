import { SchemaDefinitionRepository, TableRepository } from '../repositories';
import type { SchemaDefinition, TableMeta, Layer } from '../types';
import { TableService } from './table.service';
import type { TSearchQuery } from '../schemas';

function toTableMeta(doc: Record<string, unknown> | null): TableMeta | null {
  if (!doc) return null;
  const tableId = doc.tableId as string;
  if (!tableId) return null;
  const parsed = TableService.parseTableId(tableId);
  if (!parsed) return null;
  return {
    tableId,
    layer: parsed.layer,
    database: parsed.database,
    name: parsed.name,
    fullName: (doc.fullName as string) ?? tableId,
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

function toSchemaDefinition(doc: Record<string, unknown> | null): SchemaDefinition | null {
  if (!doc) return null;
  return {
    name: doc.name as string,
    version: (doc.version as string) ?? '1.0.0',
    description: (doc.description as string | undefined) ?? undefined,
    fields: (doc.fields as SchemaDefinition['fields']) ?? [],
    primaryKey: (doc.primaryKey as string[] | undefined) ?? [],
    updatedAt: (doc.updatedAt as string | undefined) ?? new Date().toISOString(),
  };
}

export const SearchService = {
  async searchTables(query: TSearchQuery): Promise<TableMeta[]> {
    const input = {
      q: query.q,
      limit: query.limit,
      ...(query.layer ? { layer: query.layer as Layer } : {}),
      ...(query.database ? { database: query.database } : {}),
      ...(query.tag ? { tag: query.tag } : {}),
    };
    const docs = await TableRepository.search(input);
    return docs.map((d) => toTableMeta(d)).filter((m): m is TableMeta => m !== null);
  },

  async listSchemas(): Promise<SchemaDefinition[]> {
    const docs = await SchemaDefinitionRepository.list();
    return docs
      .map((d) => toSchemaDefinition(d as unknown as Record<string, unknown>))
      .filter((s): s is SchemaDefinition => s !== null);
  },

  async getSchema(name: string): Promise<SchemaDefinition> {
    const doc = await SchemaDefinitionRepository.findByName(name);
    const sd = toSchemaDefinition(doc as unknown as Record<string, unknown>);
    if (!sd) throw new Error(`Schema '${name}' not found`);
    return sd;
  },
};