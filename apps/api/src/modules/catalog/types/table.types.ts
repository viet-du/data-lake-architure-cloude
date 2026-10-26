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
  /**
   * Which store the row came from.
   *
   * MASTER PLAN §02.2: Databricks and the local Delta lakehouse are two
   * distinct stores, so a table listing must say which one each row belongs
   * to. `databricks` = Unity Catalog, `local` = the Delta lakehouse on
   * MinIO.
   */
  provider?: 'databricks' | 'local';
  source?: 'databricks' | 'local';
  catalogName?: string;
  schemaName?: string;
  format?: string;
  tableId: string;
  layer: Layer | null;
  database: string;
  name: string;
  fullName: string;
  description?: string | undefined;
  owner?: string | undefined;
  tags: string[];
  partitions: PartitionMeta[];
  columnCount: number;
  rowCount: number | null;
  sizeBytes: number | null;
  lastModified: string | null;
  s3Path: string;
  deltaHistoryVersion: number | null;
  syncedAt: string;
}

export interface TableStats {
  tableId: string;
  rowCount: number | null;
  sizeBytes: number | null;
  columnCount: number;
  partitionCount: number;
  lastModified: string | null;
  deltaHistoryVersion: number | null;
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