import { DuckDBInstance } from '@duckdb/node-api';
import { env } from '@/config';
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

    const endpointUrl = new URL(env.S3_ENDPOINT);
    const escapeLiteral = (value: string) => value.replaceAll("'", "''");

    await conn.run(`
      CREATE SECRET object_storage_secret (
        TYPE s3,
        KEY_ID '${escapeLiteral(env.S3_ACCESS_KEY)}',
        SECRET '${escapeLiteral(env.S3_SECRET_KEY)}',
        REGION '${escapeLiteral(env.S3_REGION)}',
        ENDPOINT '${escapeLiteral(endpointUrl.host)}',
        USE_SSL ${env.S3_USE_SSL},
        URL_STYLE '${env.S3_PATH_STYLE_ACCESS ? 'path' : 'vhost'}'
      );
    `);

    logger.info({ endpoint: endpointUrl.origin }, 'DuckDB initialized with S3-compatible storage');
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