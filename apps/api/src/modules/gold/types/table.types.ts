import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';

export interface GoldTable {
  table: string;
  database: string;
  name: string;
  fullName: string;
  description?: string;
  s3Path: string;
  kind: 'fact' | 'dimension' | 'metric';
  columns: ColumnMeta[];
  partitions: PartitionMeta[];
  rowCount: number;
  fileCount: number;
  sizeBytes: number;
  lastModified: string;
  lastRefreshAt: string;
  deltaHistoryVersion: number;
  deltaHistory: GoldHistoryEntry[];
}

export interface GoldStats {
  table: string;
  rowCount: number;
  fileCount: number;
  sizeBytes: number;
  columnCount: number;
  partitionCount: number;
  lastModified: string;
  lastRefreshAt: string;
  deltaHistoryVersion: number;
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