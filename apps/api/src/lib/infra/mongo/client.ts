import mongoose from 'mongoose';
import { env, MONGO_DEFAULT_POOL_SIZE, MONGO_CONNECT_TIMEOUT_MS } from '@/config';
import { logger } from '@/lib/logger';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongo = globalThis as unknown as { _mongooseCache?: MongooseCache };
const cache: MongooseCache = globalForMongo._mongooseCache ?? { conn: null, promise: null };
if (!globalForMongo._mongooseCache) globalForMongo._mongooseCache = cache;

export async function getMongo(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env.MONGO_URI, {
        dbName: env.MONGO_DB,
        maxPoolSize: MONGO_DEFAULT_POOL_SIZE,
        serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        bufferCommands: false,
      })
      .then((m) => {
        logger.info({ uri: env.MONGO_URI, db: env.MONGO_DB }, 'MongoDB connected');
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        logger.error({ err }, 'MongoDB connection failed');
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function closeMongo(): Promise<void> {
  if (!cache.conn) return;
  await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
  logger.info('MongoDB disconnected');
}