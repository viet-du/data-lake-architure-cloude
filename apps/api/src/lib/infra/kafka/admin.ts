import { Kafka, type Admin, type Consumer, type Producer, logLevel } from 'kafkajs';
import { env } from '@/config';
import { logger } from '@/lib/logger';

interface KafkaCache {
  kafka: Kafka | null;
  admin: Admin | null;
  producer: Producer | null;
  consumer: Consumer | null;
}

const globalForKafka = globalThis as unknown as { _kafkaCache?: KafkaCache };
const cache: KafkaCache = globalForKafka._kafkaCache ?? {
  kafka: null,
  admin: null,
  producer: null,
  consumer: null,
};
if (!globalForKafka._kafkaCache) globalForKafka._kafkaCache = cache;

export function getKafka(): Kafka {
  if (cache.kafka) return cache.kafka;

  cache.kafka = new Kafka({
    clientId: 'lakehouse-api',
    brokers: env.KAFKA_BOOTSTRAP.split(',').map((b) => b.trim()),
    ssl: env.KAFKA_SECURITY_PROTOCOL === 'SSL',
    logLevel: logLevel.WARN,
    retry: { retries: 3, initialRetryTime: 300 },
  });

  logger.info({ bootstrap: env.KAFKA_BOOTSTRAP }, 'Kafka client created');
  return cache.kafka;
}

export async function getAdmin(): Promise<Admin> {
  if (cache.admin) return cache.admin;
  cache.admin = getKafka().admin();
  await cache.admin.connect();
  logger.info('Kafka admin connected');
  return cache.admin;
}

export async function getProducer(): Promise<Producer> {
  if (cache.producer) return cache.producer;
  cache.producer = getKafka().producer({ allowAutoTopicCreation: false });
  await cache.producer.connect();
  logger.info('Kafka producer connected');
  return cache.producer;
}

export async function getConsumer(groupId: string): Promise<Consumer> {
  if (cache.consumer) return cache.consumer;
  cache.consumer = getKafka().consumer({ groupId });
  await cache.consumer.connect();
  logger.info({ groupId }, 'Kafka consumer connected');
  return cache.consumer;
}

export async function closeKafka(): Promise<void> {
  if (cache.admin) {
    await cache.admin.disconnect();
    cache.admin = null;
  }
  if (cache.producer) {
    await cache.producer.disconnect();
    cache.producer = null;
  }
  if (cache.consumer) {
    await cache.consumer.disconnect();
    cache.consumer = null;
  }
  cache.kafka = null;
  logger.info('Kafka clients closed');
}