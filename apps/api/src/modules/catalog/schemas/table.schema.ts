import { z } from 'zod';
import { LAYERS } from '../types';

/**
 * Which provider the catalog reads from.
 *
 * MASTER PLAN §02.2: "Databricks and MinIO are not automatically one unified
 * data store." The catalog therefore addresses **one** provider per request
 * instead of silently merging two catalogs into an ambiguous list:
 *
 * - `databricks` — Unity Catalog + SQL Warehouse (read-only);
 * - `local` — the local Delta lakehouse on MinIO, read through DuckDB.
 *
 * The default follows `LAKEHOUSE_DATA_SOURCE` so the behaviour of an
 * existing client does not change, but a client can now address the other
 * provider explicitly — which is what the UI needs to show the datasets the
 * pipeline just produced.
 */
export const CATALOG_PROVIDERS = ['databricks', 'local'] as const;
export type TCatalogProvider = (typeof CATALOG_PROVIDERS)[number];

export const TableIdParamsSchema = z.object({
  tableId: z.string().min(1),
  provider: z.enum(CATALOG_PROVIDERS).optional(),
});

export type TTableIdParams = z.infer<typeof TableIdParamsSchema>;

export const TableLayerQuerySchema = z.object({
  layer: z.enum(LAYERS).optional(),
  database: z.string().optional(),
  search: z.string().optional(),
  provider: z.enum(CATALOG_PROVIDERS).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type TTableLayerQuery = z.infer<typeof TableLayerQuerySchema>;

export const UpdateTableMetadataSchema = z.object({
  description: z.string().max(1000).optional(),
  owner: z.string().min(1).max(120).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export type TUpdateTableMetadata = z.infer<typeof UpdateTableMetadataSchema>;

export const SampleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type TSampleQuery = z.infer<typeof SampleQuerySchema>;