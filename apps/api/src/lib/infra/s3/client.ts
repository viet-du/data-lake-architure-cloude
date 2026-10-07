import { S3Client } from '@aws-sdk/client-s3';
import { env, MINIO_DEFAULT_REGION } from '@/config';
import { logger } from '@/lib/logger';

const globalForS3 = globalThis as unknown as { _s3Client?: S3Client | null };
let client: S3Client | null = globalForS3._s3Client ?? null;

export function getS3(): S3Client {
  if (client) return client;

  client = new S3Client({
    region: MINIO_DEFAULT_REGION,
    endpoint: env.MINIO_SECURE ? `https://${env.MINIO_ENDPOINT}` : `http://${env.MINIO_ENDPOINT}`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
  });

  logger.info(
    { endpoint: env.MINIO_ENDPOINT, secure: env.MINIO_SECURE },
    'S3 client (MinIO) initialized',
  );
  globalForS3._s3Client = client;
  return client;
}

export async function closeS3(): Promise<void> {
  if (!client) return;
  client.destroy();
  client = null;
  globalForS3._s3Client = null;
  logger.info('S3 client destroyed');
}