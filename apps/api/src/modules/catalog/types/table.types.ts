import type { Layer } from './layer.enum';

export interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

export interface PartitionMeta {
  column: string;
  value: string;
}

export interface TableMeta {
  tableId: string;
  layer: Layer;
  database: string;
  name: string;
  fullName: string;
  description?: string | undefined;
  owner?: string | undefined;
  tags: string[];
  partitions: PartitionMeta[];
  columnCount: number;
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
  s3Path: string;
  deltaHistoryVersion: number;
  syncedAt: string;
}

export interface TableStats {
  tableId: string;
  rowCount: number;
  sizeBytes: number;
  columnCount: number;
  partitionCount: number;
  lastModified: string;
  deltaHistoryVersion: number;
}

export interface LineageNode {
  tableId: string;
  layer: Layer;
  database: string;
  name: string;
}

export interface LineageGraph {
  tableId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
}