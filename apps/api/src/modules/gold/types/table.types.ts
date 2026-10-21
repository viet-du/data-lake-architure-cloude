import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';

export interface GoldTable {
  table: string;
  database: string;
  name: string;
  fullName: string;
  description?: string;
  s3Path: string;
  kind: 'fact' | 'dimension' | 'metric' | null;
  columns: ColumnMeta[];
  partitions: PartitionMeta[];
  rowCount: number;
  fileCount: number | null;
  sizeBytes: number | null;
  lastModified: string | null;
  lastRefreshAt: string | null;
  deltaHistoryVersion: number | null;
  deltaHistory: GoldHistoryEntry[];
}

export interface GoldStats {
  table: string;
  rowCount: number;
  fileCount: number | null;
  sizeBytes: number | null;
  columnCount: number;
  partitionCount: number;
  lastModified: string | null;
  lastRefreshAt: string | null;
  deltaHistoryVersion: number | null;
}

export interface GoldHistoryEntry {
  version: number;
  timestamp: string;
  operation: string;
  user: string;
  notebook?: string;
  operationMetrics?: Record<string, number>;
}

export interface GoldLineageNode {
  table: string;
  layer: 'bronze' | 'silver' | 'gold';
  direction: 'upstream' | 'downstream';
}

export interface GoldLineageGraph {
  table: string;
  upstream: GoldLineageNode[];
  downstream: GoldLineageNode[];
}