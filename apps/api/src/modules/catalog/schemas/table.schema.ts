import { z } from 'zod';
import { LAYERS } from '../types';

export const TableIdParamsSchema = z.object({
  tableId: z.string().min(1),
});

export type TTableIdParams = z.infer<typeof TableIdParamsSchema>;

export const TableLayerQuerySchema = z.object({
  layer: z.enum(LAYERS).optional(),
  database: z.string().optional(),
  search: z.string().optional(),
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