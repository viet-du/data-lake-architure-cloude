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
  fileCount: number | null;
  sizeBytes: number | null;
  lastModified: string | null;
  deltaHistoryVersion: number | null;
  deltaHistory: BronzeHistoryEntry[];
}

export interface BronzeStats {
  table: string;
  rowCount: number;
  fileCount: number | null;
  sizeBytes: number | null;
  columnCount: number;
  partitionCount: number;
  lastModified: string | null;
  deltaHistoryVersion: number | null;
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
  sizeBytes: number | null;
  lastModified: string | null;
}