import { Kafka, type Admin, type Consumer, type Producer, type ITopicMetadata } from 'kafkajs';
import { AppError } from '@/errors';

const KAFKA_CLIENT_ID = 'lakehouse-api';
const KAFKA_DEFAULT_BROKERS = ['localhost:9092'];

/**
 * How long a failed broker is remembered before another attempt is made.
 *
 * Without it, every request that touches Kafka waits for the full kafkajs
 * connect timeout (5s) plus its retries. The dashboard fans out over
 * several providers, so a dead broker turned every Home refresh into a
 * ~20 second request — and the operator got no answer at all.
 *
 * The window is short enough that a broker which comes back is picked up
 * quickly, and long enough that a request storm does not hammer a broker
 * that is known to be down.
 */
const BROKER_UNAVAILABLE_TTL_MS = 10_000;

function getBrokers(): string[] {
  const raw = process.env.KAFKA_BOOTSTRAP ?? process.env.KAFKA_BOOTSTRAP_SERVERS ?? process.env.KAFKA_BROKERS ?? KAFKA_DEFAULT_BROKERS.join(',');
  return raw.split(',').map((b) => b.trim()).filter(Boolean);
}

let kafka: Kafka | null = null;
let adminInstance: Admin | null = null;
let producerInstance: Producer | null = null;
let adminConnection: Promise<Admin> | null = null;
let producerConnection: Promise<Producer> | null = null;
const ephemeralConsumers: Consumer[] = [];

/**
 * The instant until which the broker is known to be unreachable.
 *
 * `null` means "not known to be down" — the normal state.
 */
let brokerUnavailableUntil = 0;

/**
 * Translate a raw kafkajs failure into a typed, client-facing error.
 *
 * The kafkajs errors are opaque (`KafkaJSProtocolError`, plain `Error`
 * with a `Connection error: getaddrinfo ENOTFOUND kafka` message, …). Left
 * untyped they escape the route as a generic HTTP 500, which tells the
 * caller nothing and — worse — makes a *dependency* failure look like a
 * *server* bug.
 *
 * A broker that cannot be reached is a **503**: the request was correct,
 * the dependency was not available. The message keeps the original cause
 * so the operator can see *why* the broker was unreachable.
 */
function toKafkaUnavailableError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  const unreachable =
    /getaddrinfo|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EPIPE|timeout|timed out|disconnect/i.test(
      message,
    );
  return new AppError(
    503,
    'KAFKA_UNAVAILABLE',
    `Kafka is unavailable: ${message}`,
    unreachable ? { cause: 'unreachable' } : undefined,
  );
}


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
    if (adminConnection) return adminConnection;
    // Fast-fail: the broker was just proven unreachable. Attempting a
    // connection again would cost the full kafkajs timeout on *every*
    // request, which is what turned a single broker outage into a
    // dashboard-wide stall.
    if (Date.now() < brokerUnavailableUntil) {
      throw new AppError(
        503,
        'KAFKA_UNAVAILABLE',
        'Kafka is unavailable: the broker did not answer the last connection attempt.',
      );
    }
    const candidate = buildKafka().admin();
    adminConnection = candidate.connect().then(
      () => {
        adminInstance = candidate;
        adminConnection = null;
        brokerUnavailableUntil = 0;
        return candidate;
      },
      async (error: Error) => {
        adminConnection = null;
        brokerUnavailableUntil = Date.now() + BROKER_UNAVAILABLE_TTL_MS;
        await candidate.disconnect().catch(() => undefined);
        throw toKafkaUnavailableError(error);
      },
    );
    return adminConnection;
  },

  async producer(): Promise<Producer> {
    if (producerInstance) return producerInstance;
    if (producerConnection) return producerConnection;
    if (Date.now() < brokerUnavailableUntil) {
      throw new AppError(
        503,
        'KAFKA_UNAVAILABLE',
        'Kafka is unavailable: the broker did not answer the last connection attempt.',
      );
    }
    const candidate = buildKafka().producer({
      allowAutoTopicCreation: false,
      idempotent: true,
    });
    producerConnection = candidate.connect().then(
      () => {
        producerInstance = candidate;
        producerConnection = null;
        brokerUnavailableUntil = 0;
        return candidate;
      },
      async (error: Error) => {
        producerConnection = null;
        brokerUnavailableUntil = Date.now() + BROKER_UNAVAILABLE_TTL_MS;
        await candidate.disconnect().catch(() => undefined);
        throw toKafkaUnavailableError(error);
      },
    );
    return producerConnection;
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

  /**
   * The end offsets of a topic, or an empty list when they cannot be read.
   *
   * `admin.fetchTopicOffsets()` is **not** safe to call unguarded.
   * Inside kafkajs it fetches the high and the low watermark and then does
   * `high.pop()` / `low.pop()` on the result. When the topic is not part of
   * the client's cached metadata — a topic that was just created, or one
   * that was deleted while the API was running — the fetch resolves with an
   * *empty* array, `pop()` returns `undefined`, and kafkajs throws
   *
   *   TypeError: Cannot destructure property 'partitions' of 'c.pop(...)'
   *              as it is undefined.
   *
   * That is not a Kafka error the caller can interpret: it is a plain
   * `TypeError` that escapes the route as an HTTP 500. The dashboard then
   * shows a broken screen for a topic that is simply not readable *yet*.
   *
   * This wrapper turns that into the honest answer — "no offsets right
   * now" — and, when the topic is unknown, refreshes the metadata once and
   * retries, so a topic that was created a moment ago is not reported as
   * empty forever.
   */
  async safeFetchTopicOffsets(
    admin: Admin,
    topic: string,
  ): Promise<Array<{ partition: number; offset: string; high?: string; low?: string }>> {
    const read = async (): Promise<
      Array<{ partition: number; offset: string; high?: string; low?: string }>
    > => {
      const offsets = await admin.fetchTopicOffsets(topic);
      // A topic with no readable partition yields no offset at all. The
      // caller treats that as "no data yet", never as a zero row count.
      return offsets ?? [];
    };

    try {
      const offsets = await read();
      if (offsets.length > 0) return offsets;
    } catch {
      // fall through to the refresh-and-retry below
    }

    // The topic may simply be unknown to the cached metadata.
    try {
      await admin.fetchTopicMetadata({ topics: [topic] });
    } catch {
      return [];
    }

    try {
      return await read();
    } catch {
      return [];
    }
  },

  /**
   * Run a request against the admin client, with typed errors.
   *
   * A broker that dies *after* the connection was established leaves a
   * stale admin in the cache. Every subsequent request then failed with a
   * raw kafkajs error — an opaque HTTP 500 for what is plainly a
   * dependency failure.
   *
   * This wrapper does two things:
   *
   *  1. it discards the cached admin when the request fails, so the next
   *     call reconnects instead of reusing a dead socket; and
   *  2. it translates the failure into a typed `AppError` (503 for an
   *     unreachable broker), so the route answers with a status the client
   *     can act on.
   */
  async withAdmin<T>(run: (admin: Admin) => Promise<T>): Promise<T> {
    const admin = await this.admin();
    try {
      return await run(admin);
    } catch (error) {
      // The cached admin may be the reason: drop it so the next attempt
      // establishes a fresh connection.
      if (adminInstance === admin) {
        adminInstance = null;
        adminConnection = null;
        brokerUnavailableUntil = Date.now() + BROKER_UNAVAILABLE_TTL_MS;
      }
      if (error instanceof AppError) throw error;
      throw toKafkaUnavailableError(error);
    }
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
    producerConnection = null;
    if (adminInstance) {
      try {
        await adminInstance.disconnect();
      } catch {
        // ignore
      }
      adminInstance = null;
    }
    adminConnection = null;
    kafka = null;
  },

  isConnected(): boolean {
    return adminInstance !== null;
  },
};

export type { ITopicMetadata };
