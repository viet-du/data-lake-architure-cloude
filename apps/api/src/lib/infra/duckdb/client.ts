import { DuckDBInstance } from '@duckdb/node-api';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { env } from '@/config';
import { logger } from '@/lib/logger';

const globalForDuck = globalThis as unknown as { _duckdbInit?: Promise<DuckDBInstance> | null };
let initPromise: Promise<DuckDBInstance> | null = globalForDuck._duckdbInit ?? null;

/**
 * The directory DuckDB uses for its configuration, the extension cache and
 * the secret store.
 *
 * DuckDB resolves the home directory from `$HOME` (or from the OS user
 * database) and aborts with
 *
 *     IO Error: Can't find the home directory at '/home/nextjs'
 *
 * when the account has no home directory. The container runs the API as the
 * `nextjs` system account, which is created *without* a home directory, so
 * this is the normal case in Docker — not an edge case.
 *
 * A dedicated directory under the system temporary directory is used so the
 * extension cache is writable by the unprivileged runtime user and never
 * leaks between containers.
 */
function duckdbHomeDirectory(): string {
  const candidates = [
    process.env.DUCKDB_HOME_DIRECTORY,
    process.env.HOME ? join(process.env.HOME, '.duckdb') : undefined,
    join(tmpdir(), 'duckdb-home'),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // Try the next candidate; a read-only or unwritable directory must not
      // abort the whole initialisation.
    }
  }
  return homedir();
}

export async function getDuckDB(): Promise<DuckDBInstance> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const homeDirectory = duckdbHomeDirectory();
    const instance = await DuckDBInstance.create();
    const conn = await instance.connect();

    // DuckDB resolves its home directory *before* the first statement runs,
    // so the directory has to exist and the setting has to be applied as a
    // statement on the connection. `SET home_directory = '…'` is the
    // documented way to point DuckDB at a writable directory; the
    // `home_directory` option of `DuckDBInstance.create()` is applied too
    // late to prevent the start-up lookup.
    await conn.run(`SET home_directory = '${homeDirectory.replaceAll("'", "''")}';`);

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