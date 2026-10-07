export const APP_NAME = 'Data Lake Control Plane API';
export const APP_VERSION = '1.0.0';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

export const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
export const MAX_QUERY_TIMEOUT_MS = 300_000;
export const MAX_AD_HOC_ROWS = 10_000;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 3;

export const DELTA_RETENTION_DAYS = 7;
export const DELTA_HISTORY_LIMIT = 100;

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORS_DEFAULT_HEADERS = ['Content-Type', 'Authorization', REQUEST_ID_HEADER];

export const HEALTH_CACHE_TTL_MS = 5_000;

export const MINIO_DEFAULT_REGION = 'us-east-1';

export const MONGO_DEFAULT_POOL_SIZE = 20;
export const MONGO_CONNECT_TIMEOUT_MS = 10_000;

export const REDIS_KEY_PREFIX = 'lakehouse:';

export const SWAGGER_API_FOLDER = 'src/app/api';
export const SWAGGER_TITLE = APP_NAME;
export const SWAGGER_VERSION = APP_VERSION;