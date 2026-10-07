import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';

export interface SilverTable {
  table: string;
  database: string;
  name: string;
  fullName: string;
  description?: string;
  s3Path: string;
  columns: ColumnMeta[];
  partitions: PartitionMeta[];
  rowCount: number;
  fileCount: number;
  sizeBytes: number;
  lastModified: string;
  deltaHistoryVersion: number;
  deltaHistory: SilverHistoryEntry[];
}

export interface SilverStats {
  table: string;
  rowCount: number;
  fileCount: number;
  sizeBytes: number;
  columnCount: number;
  partitionCount: number;
  lastModified: string;
  deltaHistoryVersion: number;
}

export interface SilverHistoryEntry {
  version: number;
  timestamp: string;
  operation: string;
  user: string;
  notebook?: string;
  operationMetrics?: Record<string, number>;
}

export interface SilverPartition {
  partition: string;
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
}

export interface TimeTravelData {
  table: string;
  version: number;
  timestamp: string;
  rowCount: number;
  sample: Array<Record<string, unknown>>;
}

export interface DiffResult {
  table: string;
  v1: number;
  v2: number;
  addedRows: number;
  removedRows: number;
  changedRows: number;
  changes: Array<{
    rowKey: string;
    field: string;
    v1Value: unknown;
    v2Value: unknown;
  }>;
}