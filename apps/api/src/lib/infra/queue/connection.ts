import { Redis } from 'ioredis';
import { env, REDIS_KEY_PREFIX } from '@/config';
import { logger } from '@/lib/logger';

const globalForQueue = globalThis as unknown as { _queueConnection?: Redis | null };
let connection: Redis | null = globalForQueue._queueConnection ?? null;

export function getQueueConnection(): Redis {
  if (connection) return connection;
  connection = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    keyPrefix: REDIS_KEY_PREFIX,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  connection.on('connect', () =>
    logger.info({ host: env.REDIS_HOST, port: env.REDIS_PORT }, 'Queue Redis connecting'),
  );
  connection.on('ready', () => logger.info('Queue Redis ready'));
  connection.on('error', (err) => logger.error({ err }, 'Queue Redis error'));
  connection.on('close', () => logger.warn('Queue Redis closed'));
  globalForQueue._queueConnection = connection;
  return connection;
}

export async function closeQueueConnection(): Promise<void> {
  if (!connection) return;
  await connection.quit();
  connection = null;
  globalForQueue._queueConnection = null;
  logger.info('Queue Redis disconnected');
}