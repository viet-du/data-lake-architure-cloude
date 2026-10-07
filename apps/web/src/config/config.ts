export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
  environment: (import.meta.env.VITE_ENV ?? 'development') as 'development' | 'staging' | 'production',
  enableMockData: import.meta.env.VITE_ENABLE_MOCK === 'true',
  language: {
    default: (import.meta.env.VITE_DEFAULT_LANG ?? 'en') as 'en' | 'vi',
    supported: ['en', 'vi'] as const,
  },
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  refreshIntervalMs: 30_000,
} as const;

export type AppConfig = typeof APP_CONFIG;
