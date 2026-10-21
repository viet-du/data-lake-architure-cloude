import { getMongo } from '@/lib/infra/mongo';
import { getRedis } from '@/lib/infra/redis';
import { getDuckDB } from '@/lib/infra/duckdb';
import { getS3 } from '@/lib/infra/s3';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getAdmin } from '@/lib/infra/kafka';
import { airflowFetch, AirflowError } from '@/lib/infra/airflow';
import { env, APP_NAME, APP_VERSION, HEALTH_CACHE_TTL_MS } from '@/config';
import type { TServiceStatus, THealthResponse, TAppInfoResponse } from '../schemas';
import { z } from 'zod';
import { usesDatabricks, databricksRequest } from '@/lib/infra/databricks/client';


async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number } | { error: unknown; latencyMs: number }> {
  const start = Date.now();
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([fn(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Health check timed out')), 5000);
    })]).finally(() => clearTimeout(timer));
    return { result, latencyMs: Date.now() - start };
  } catch (error) {
    return { error, latencyMs: Date.now() - start };
  }
}

async function checkMongo(deep: boolean): Promise<Omit<TServiceStatus, 'name'>> {
  if (!deep) return { status: 'skipped', details: { mode: 'deep-only' } };
  const r = await timed(async () => {
    if (deep) {
      await getMongo();
      return await mongoose_status_check();
    }
    return { connectionState: 'skip' };
  });
  if ('error' in r) {
    return { status: 'down', latencyMs: r.latencyMs, message: 'Mongo connection failed', details: r.error };
  }
  return { status: 'up', latencyMs: r.latencyMs, details: r.result };
}

async function mongoose_status_check(): Promise<unknown> {
  const m = await getMongo();
  return { connectionState: m.connection.readyState };
}

async function checkRedis(deep: boolean): Promise<Omit<TServiceStatus, 'name'>> {
  if (!deep) return { status: 'skipped', details: { mode: 'deep-only' } };
  const r = await timed(async () => {
    const redis = getRedis();
    if (deep) {
      const reply = await redis.ping();
      return { ping: reply };
    }
    return { ping: 'skip' };
  });
  if ('error' in r) {
    return { status: 'down', latencyMs: r.latencyMs, message: 'Redis error', details: r.error };
  }
  return { status: 'up', latencyMs: r.latencyMs, details: r.result };
}

async function checkDuckDB(deep: boolean): Promise<Omit<TServiceStatus, 'name'>> {
  if (!deep) return { status: 'skipped', details: { mode: 'deep-only' } };
  const r = await timed(async () => {
    if (deep) {
      const inst = await getDuckDB();
      const conn = await inst.connect();
      await conn.run('SELECT 1;');
      return { selectOk: true };
    }
    return { selectOk: 'skip' };
  });
  if ('error' in r) {
    return { status: 'down', latencyMs: r.latencyMs, message: 'DuckDB error', details: r.error };
  }
  return { status: 'up', latencyMs: r.latencyMs, details: r.result };
}

async function checkMinio(deep: boolean): Promise<Omit<TServiceStatus, 'name'>> {
  if (!deep) {
    return { status: 'skipped', details: { mode: 'deep-only' } };
  }
  const r = await timed(async () => {
    const s3 = getS3();
    const cmd = new HeadBucketCommand({ Bucket: 'lakehouse' });
    return s3.send(cmd);
  });
  if ('error' in r) {
    const name = (r.error as { name?: string }).name ?? 'Unknown';
    return { status: 'down', latencyMs: r.latencyMs, message: `MinIO error: ${name}`, details: r.error };
  }
  return { status: 'up', latencyMs: r.latencyMs, details: { bucket: 'lakehouse' } };
}

async function checkKafka(deep: boolean): Promise<Omit<TServiceStatus, 'name'>> {
  if (!deep) return { status: 'skipped', details: { mode: 'deep-only' } };
  const r = await timed(async () => {
    if (deep) {
      const admin = await getAdmin();
      const topics = await admin.listTopics();
      return { topics: topics.length };
    }
    return { topics: 'skip' };
  });
  if ('error' in r) {
    return { status: 'down', latencyMs: r.latencyMs, message: 'Kafka error', details: r.error };
  }
  return { status: 'up', latencyMs: r.latencyMs, details: r.result };
}

export function airflowReadiness(input: unknown): 'up' | 'down' {
  const result = z.object({
    metadatabase: z.object({ status: z.string().nullable() }),
    scheduler: z.object({ status: z.string().nullable() }),
  }).safeParse(input);
  return result.success && result.data.metadatabase.status === 'healthy' && result.data.scheduler.status === 'healthy' ? 'up' : 'down';
}

async function checkAirflow(): Promise<Omit<TServiceStatus, 'name'>> {
  if (!env.AIRFLOW_BASE_URL) {
    return { status: 'skipped', details: { reason: 'AIRFLOW_BASE_URL not configured' } };
  }
  const r = await timed(async () => airflowFetch('/health'));
  if ('error' in r) {
    if (r.error instanceof AirflowError) {
      return { status: 'down', latencyMs: r.latencyMs, message: r.error.message, details: r.error };
    }
    return { status: 'down', latencyMs: r.latencyMs, message: 'Airflow unreachable', details: r.error };
  }
  const status = airflowReadiness(r.result);
  return { status, latencyMs: r.latencyMs, details: r.result,
    ...(status === 'down' ? { message: 'Airflow scheduler or metadata database is not healthy' } : {}),
  };
}

export const HealthService = {
  async check(deep: boolean): Promise<THealthResponse> {
    const [mongo, redis, duckdb, minio, airflow] = await Promise.all([
      checkMongo(deep),
      checkRedis(deep),
      checkDuckDB(deep),
      checkMinio(deep),
      deep ? checkAirflow() : Promise.resolve({ status: 'skipped' as const, details: { mode: 'deep-only' } }),
    ]);
    const kafka = await checkKafka(deep);

    const services = [
      { name: 'MongoDB', ...mongo }, { name: 'Redis', ...redis },
      { name: 'DuckDB', ...duckdb }, { name: 'MinIO', ...minio },
      { name: 'Kafka', ...kafka }, { name: 'Airflow', ...airflow },
    ];
    if (usesDatabricks()) {
      const check = deep ? await timed(async () => {
        await databricksRequest(`/api/2.1/unity-catalog/catalogs/${encodeURIComponent(env.DATABRICKS_CATALOG)}`);
        return z.object({ state: z.string() }).parse(await databricksRequest(`/api/2.0/sql/warehouses/${env.DATABRICKS_WAREHOUSE_ID}`));
      }) : null;
      services.push(check === null ? { name: 'Databricks', status: 'skipped', details: { mode: 'deep-only' } }
        : 'error' in check ? { name: 'Databricks', status: 'down', latencyMs: check.latencyMs, message: 'Databricks connection or authorization failed', details: {} }
          : { name: 'Databricks', status: check.result.state === 'RUNNING' ? 'up' : 'degraded', latencyMs: check.latencyMs, details: { warehouseState: check.result.state } });
    }
    const anyDown = services.some((s) => s.status === 'down');
    const anyDegraded = services.some((s) => s.status === 'degraded');
    const overall = anyDown ? 'down' : anyDegraded ? 'degraded' : 'ok';


    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime() * 1000),
      services,
    };
  },

  async info(): Promise<TAppInfoResponse> {
    return {
      dataSource: env.LAKEHOUSE_DATA_SOURCE,
      catalog: env.LAKEHOUSE_DATA_SOURCE === 'databricks' ? env.DATABRICKS_CATALOG : null,
      workspaceId: env.LAKEHOUSE_DATA_SOURCE === 'databricks' ? env.DATABRICKS_WORKSPACE_ID ?? null : null,
      readOnly: env.LAKEHOUSE_DATA_SOURCE === 'databricks',
      name: APP_NAME,
      version: APP_VERSION,
      env: env.ENV,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime() * 1000),
      timestamp: new Date().toISOString(),
    };
  },
};

export { HEALTH_CACHE_TTL_MS };
