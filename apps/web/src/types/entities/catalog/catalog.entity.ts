import type { EHealthStatus, DateRange } from '@/types/commons';

export type EMedallionLayer = 'bronze' | 'silver' | 'gold';

export interface DatabaseEntity {
  id: string;
  name: string;
  catalogName: string;
  location?: string;
  layer: EMedallionLayer;
  tableCount: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TableEntity {
  id: string;
  databaseId: string;
  databaseName: string;
  name: string;
  format: 'delta' | 'parquet' | 'iceberg' | 'csv' | 'json';
  layer: EMedallionLayer;
  sizeBytes: number;
  rowCount: number;
  partitionBy?: ReadonlyArray<string>;
  columns: ReadonlyArray<TableColumn>;
  createdAt: string;
  updatedAt: string;
  lastQueryAt?: string;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  isPartition: boolean;
}

export interface PipelineRunEntity {
  id: string;
  pipelineName: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: 'manual' | 'schedule' | 'api' | 'webhook';
  layer: EMedallionLayer;
  recordsProcessed?: number;
  bytesProcessed?: number;
  errorMessage?: string;
  dagId?: string;
}

export interface KafkaTopicEntity {
  name: string;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
  messagesPerSec: number;
  consumerGroups: number;
  lag: number;
  status: EHealthStatus;
}

export interface DQCheckEntity {
  id: string;
  tableName: string;
  ruleName: string;
  ruleType: 'not_null' | 'unique' | 'range' | 'regex' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pass' | 'fail' | 'warning';
  lastRunAt: string;
  failedRows?: number;
  totalRows?: number;
}

export interface CrawlerJobEntity {
  id: string;
  source: string;
  category: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  pagesScraped: number;
  recordsCollected: number;
  recordsFailed: number;
  ratePerMinute: number;
  errorMessage?: string;
}

export interface HealthSnapshot {
  status: EHealthStatus;
  uptime: number;
  timestamp: string;
  services: ReadonlyArray<{
    name: string;
    status: EHealthStatus;
    latencyMs: number;
  }>;
  range?: DateRange;
}
