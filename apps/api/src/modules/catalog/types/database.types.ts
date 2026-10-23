import type { Layer } from './layer.enum';

export interface DatabaseMeta {
  catalogName?: string;
  systemSchema?: boolean;
  source?: 'databricks' | 'local';
  database: string;
  description?: string | null;
  layers: Layer[];
  tableCount: number;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}