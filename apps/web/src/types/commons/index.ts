export type EStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface DateRange {
  from: string;
  to: string;
}

export type EHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  name: string;
  status: EHealthStatus;
  message?: string;
  lastCheckedAt: string;
  durationMs?: number;
}
