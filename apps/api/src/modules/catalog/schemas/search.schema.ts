import { z } from 'zod';
import { LAYERS } from '../types';

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  layer: z.enum(LAYERS).optional(),
  database: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TSearchQuery = z.infer<typeof SearchQuerySchema>;

export const SchemaNameParamsSchema = z.object({
  name: z.string().min(1),
});

export type TSchemaNameParams = z.infer<typeof SchemaNameParamsSchema>;