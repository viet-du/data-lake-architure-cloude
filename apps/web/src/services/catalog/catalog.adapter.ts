import { z } from 'zod';
import type { DatabaseEntity, TableEntity } from '@/types/entities';

const layer = z.enum(['bronze', 'silver', 'gold']);
const databaseSchema = z.object({
  database: z.string(), layers: z.array(layer), tableCount: z.number(),
  description: z.string().nullable(), createdAt: z.string().nullable(), updatedAt: z.string().nullable(), catalogName: z.string().optional(), systemSchema: z.boolean().optional(), source: z.enum(['local', 'databricks']).optional(),
});
const tableSchema = z.object({
  tableId: z.string(), database: z.string(), name: z.string(), layer: layer.nullable(), format: z.string().optional(),
  sizeBytes: z.number().nullable(), rowCount: z.number().nullable(), lastModified: z.string().nullable(),
});

export function decodeDatabase(input: unknown): DatabaseEntity {
  const value = databaseSchema.parse(input);
  return {
    id: value.database, name: value.database, catalogName: value.catalogName ?? 'lakehouse', ...(value.systemSchema === undefined ? {} : { systemSchema: value.systemSchema }), ...(value.source ? { source: value.source } : {}), layers: value.layers,
    tableCount: value.tableCount, ...(value.createdAt ? { createdAt: value.createdAt } : {}), updatedAt: value.updatedAt,
    ...(value.description === null ? {} : { description: value.description }),
  };
}

export function decodeTable(input: unknown): TableEntity {
  const value = tableSchema.parse(input);
  return {
    id: value.tableId, databaseId: value.database, databaseName: value.database,
    name: value.name, layer: value.layer, format: value.format ?? 'delta', sizeBytes: value.sizeBytes,
    rowCount: value.rowCount, updatedAt: value.lastModified,
  };
}

export const decodeDatabases = (input: unknown) => z.array(z.unknown()).parse(input).map(decodeDatabase);
export const decodeTables = (input: unknown) => z.array(z.unknown()).parse(input).map(decodeTable);
