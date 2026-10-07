import { getMongo, closeMongo } from '@/lib/infra/mongo';
import { getRedis } from '@/lib/infra/redis';
import { getDuckDB } from '@/lib/infra/duckdb';
import { getS3 } from '@/lib/infra/s3';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getAdmin } from '@/lib/infra/kafka';
import { airflowFetch, AirflowError } from '@/lib/infra/airflow';
import { env, APP_NAME, APP_VERSION, HEALTH_CACHE_TTL_MS } from '@/config';
import type { TServiceStatus, THealthResponse, TAppInfoResponse } from '../schemas';

const processStart = Date.now();

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number } | { error: unknown; latencyMs: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    return { result, latencyMs: Date.now() - start };
  } catch (error) {
    return { error, latencyMs: Date.now() - start };
  }
}

async function checkMongo(deep: boolean): Promise<TServiceStatus> {
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

async function checkRedis(deep: boolean): Promise<TServiceStatus> {
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

async function checkDuckDB(deep: boolean): Promise<TServiceStatus> {
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

async function checkMinio(deep: boolean): Promise<TServiceStatus> {
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

async function checkKafka(deep: boolean): Promise<TServiceStatus> {
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

async function checkAirflow(): Promise<TServiceStatus> {
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
  return { status: 'up', latencyMs: r.latencyMs, details: r.result };
}

export const HealthService = {
  async check(deep: boolean): Promise<THealthResponse> {
    const [mongo, redis, duckdb, minio, airflow] = await Promise.all([
      checkMongo(deep),
      checkRedis(deep),
      checkDuckDB(deep),
      checkMinio(deep),
      checkAirflow(),
    ]);
    const kafka = await checkKafka(deep);

    const services = [mongo, redis, duckdb, minio, kafka, airflow];
    const anyDown = services.some((s) => s.status === 'down');
    const anyDegraded = services.some((s) => s.status === 'degraded');
    const overall = anyDown ? 'down' : anyDegraded ? 'degraded' : 'ok';

    if (!deep) {
      await closeMongo().catch(() => undefined);
    }

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - processStart,
      services,
    };
  },

  async info(): Promise<TAppInfoResponse> {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      env: env.ENV,
      nodeVersion: process.version,
      uptime: Date.now() - processStart,
      timestamp: new Date().toISOString(),
    };
  },
};

export { HEALTH_CACHE_TTL_MS };