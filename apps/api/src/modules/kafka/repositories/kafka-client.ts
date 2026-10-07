import { Kafka, type Admin, type Consumer, type Producer, type ITopicMetadata } from 'kafkajs';

const KAFKA_CLIENT_ID = 'lakehouse-api';
const KAFKA_DEFAULT_BROKERS = ['localhost:9092'];

function getBrokers(): string[] {
  const raw = process.env.KAFKA_BOOTSTRAP_SERVERS ?? process.env.KAFKA_BROKERS ?? KAFKA_DEFAULT_BROKERS.join(',');
  return raw.split(',').map((b) => b.trim()).filter(Boolean);
}

let kafka: Kafka | null = null;
let adminInstance: Admin | null = null;
let producerInstance: Producer | null = null;
const ephemeralConsumers: Consumer[] = [];

function buildKafka(): Kafka {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: KAFKA_CLIENT_ID,
    brokers: getBrokers(),
    connectionTimeout: 5_000,
    requestTimeout: 30_000,
    retry: { initialRetryTime: 300, retries: 5 },
  });
  return kafka;
}

export const KafkaClient = {
  getBrokers(): string[] {
    return getBrokers();
  },

  raw(): Kafka {
    return buildKafka();
  },

  async admin(): Promise<Admin> {
    if (adminInstance) return adminInstance;
    adminInstance = buildKafka().admin();
    await adminInstance.connect();
    return adminInstance;
  },

  async producer(): Promise<Producer> {
    if (producerInstance) return producerInstance;
    producerInstance = buildKafka().producer({
      allowAutoTopicCreation: false,
      idempotent: true,
    });
    await producerInstance.connect();
    return producerInstance;
  },

  async consumer(groupId: string): Promise<Consumer> {
    const c = buildKafka().consumer({
      groupId,
      sessionTimeout: 10_000,
      heartbeatInterval: 3_000,
    });
    await c.connect();
    ephemeralConsumers.push(c);
    return c;
  },

  async disconnectEphemeralConsumer(c: Consumer): Promise<void> {
    try {
      await c.disconnect();
    } catch {
      // ignore
    }
    const idx = ephemeralConsumers.indexOf(c);
    if (idx >= 0) ephemeralConsumers.splice(idx, 1);
  },

  async closeAll(): Promise<void> {
    for (const c of ephemeralConsumers) {
      try {
        await c.disconnect();
      } catch {
        // ignore
      }
    }
    ephemeralConsumers.length = 0;
    if (producerInstance) {
      try {
        await producerInstance.disconnect();
      } catch {
        // ignore
      }
      producerInstance = null;
    }
    if (adminInstance) {
      try {
        await adminInstance.disconnect();
      } catch {
        // ignore
      }
      adminInstance = null;
    }
  },

  isConnected(): boolean {
    return adminInstance !== null;
  },
};

export type { ITopicMetadata };