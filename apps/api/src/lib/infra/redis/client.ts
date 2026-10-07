import { Redis } from 'ioredis';
import { env, REDIS_KEY_PREFIX } from '@/config';
import { logger } from '@/lib/logger';

const globalForRedis = globalThis as unknown as { _redisClient?: Redis | null };
let client: Redis | null = globalForRedis._redisClient ?? null;

export function getRedis(): Redis {
  if (client) return client;

  client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    keyPrefix: REDIS_KEY_PREFIX,
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  client.on('connect', () => logger.info({ host: env.REDIS_HOST, port: env.REDIS_PORT }, 'Redis connecting'));
  client.on('ready', () => logger.info('Redis ready'));
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  client.on('close', () => logger.warn('Redis closed'));

  globalForRedis._redisClient = client;
  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  await client.quit();
  client = null;
  globalForRedis._redisClient = null;
  logger.info('Redis disconnected');
}