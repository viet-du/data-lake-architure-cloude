import { z } from 'zod';
import { LAYERS } from '../types';

export const CreateDatabaseSchema = z.object({
  database: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'database name must be lowercase alphanumeric + underscore'),
  description: z.string().max(500).optional(),
  layers: z.array(z.enum(LAYERS)).min(1).default(['bronze', 'silver', 'gold']),
});

export type TCreateDatabase = z.infer<typeof CreateDatabaseSchema>;

export const DatabaseParamsSchema = z.object({
  db: z.string().min(1),
});

export type TDatabaseParams = z.infer<typeof DatabaseParamsSchema>;