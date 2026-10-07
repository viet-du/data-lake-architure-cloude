import { DuckDBInstance } from '@duckdb/node-api';
import { env, MINIO_DEFAULT_REGION } from '@/config';
import { logger } from '@/lib/logger';

const globalForDuck = globalThis as unknown as { _duckdbInit?: Promise<DuckDBInstance> | null };
let initPromise: Promise<DuckDBInstance> | null = globalForDuck._duckdbInit ?? null;

export async function getDuckDB(): Promise<DuckDBInstance> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    await conn.run(`SET memory_limit = '${env.DUCKDB_MEMORY_LIMIT}';`);
    await conn.run(`SET threads TO ${env.DUCKDB_THREADS};`);

    await conn.run('INSTALL httpfs; LOAD httpfs;');
    await conn.run('INSTALL delta; LOAD delta;');

    const endpointUrl = env.MINIO_SECURE
      ? `https://${env.MINIO_ENDPOINT}`
      : `http://${env.MINIO_ENDPOINT}`;

    await conn.run(`
      CREATE SECRET minio_secret (
        TYPE s3,
        KEY_ID '${env.MINIO_ACCESS_KEY}',
        SECRET '${env.MINIO_SECRET_KEY}',
        REGION '${MINIO_DEFAULT_REGION}',
        ENDPOINT '${endpointUrl}',
        USE_SSL ${env.MINIO_SECURE},
        URL_STYLE 'path'
      );
    `);

    logger.info({ endpoint: endpointUrl }, 'DuckDB initialized with MinIO secret');
    return instance;
  })().catch((err) => {
    initPromise = null;
    globalForDuck._duckdbInit = null;
    logger.error({ err }, 'DuckDB initialization failed');
    throw err;
  });

  globalForDuck._duckdbInit = initPromise;
  return initPromise;
}

export function closeDuckDB(): void {
  if (!initPromise) return;
  initPromise.then((instance) => {
    instance.closeSync();
    logger.info('DuckDB closed');
  });
  initPromise = null;
  globalForDuck._duckdbInit = null;
}