import type { EHealthStatus, HealthCheck } from '@/types/commons';

export interface HealthResponse {
  status: EHealthStatus;
  uptime: number;
  timestamp: string;
  version?: string;
  services: ReadonlyArray<HealthCheck>;
  metrics?: Readonly<Record<string, number>>;
}

export type HealthDeepResponse = HealthResponse;

export interface HealthInfo {
  appName: string;
  version: string;
  environment: string;
  apiVersion?: string;
  dataSource: 'local' | 'databricks';
  catalog: string | null;
  workspaceId: string | null;
  readOnly: boolean;
  buildTime?: string;
  gitCommit?: string;
}
