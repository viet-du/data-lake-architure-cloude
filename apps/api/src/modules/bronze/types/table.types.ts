import type { ColumnMeta, PartitionMeta } from '@/modules/catalog/types/table.types';

export interface BronzeTable {
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
  deltaHistory: BronzeHistoryEntry[];
}

export interface BronzeStats {
  table: string;
  rowCount: number;
  fileCount: number;
  sizeBytes: number;
  columnCount: number;
  partitionCount: number;
  lastModified: string;
  deltaHistoryVersion: number;
}

export interface BronzeHistoryEntry {
  version: number;
  timestamp: string;
  operation: string;
  user: string;
  notebook?: string;
  operationMetrics?: Record<string, number>;
}

export interface BronzePartition {
  partition: string;
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
}