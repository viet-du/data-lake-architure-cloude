import type { Layer } from './layer.enum';

export interface DatabaseMeta {
  database: string;
  description?: string | null;
  layers: Layer[];
  tableCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}