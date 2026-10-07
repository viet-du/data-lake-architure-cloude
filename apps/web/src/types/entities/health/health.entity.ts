import type { EHealthStatus, HealthCheck } from '@/types/commons';

export interface HealthResponse {
  status: EHealthStatus;
  uptime: number;
  timestamp: string;
  version: string;
  services: ReadonlyArray<HealthCheck>;
  metrics?: Readonly<Record<string, number>>;
}

export interface HealthDeepResponse extends HealthResponse {
  dependencies: {
    minio: EHealthStatus;
    kafka: EHealthStatus;
    mongodb: EHealthStatus;
    redis: EHealthStatus;
    spark: EHealthStatus;
    deltaLake: EHealthStatus;
  };
  system: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    networkIn: number;
    networkOut: number;
  };
}

export interface HealthInfo {
  appName: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  apiVersion: string;
  buildTime?: string;
  gitCommit?: string;
}
