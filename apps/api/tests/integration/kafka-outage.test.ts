import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The Kafka client's outage behaviour.
 *
 * HOME-003 / R1 / R2: a dead broker used to surface as an opaque HTTP 500
 * and cost the full kafkajs connect timeout on *every* request. The
 * contract pinned here:
 *
 *  * an unreachable broker is a typed 503 `KAFKA_UNAVAILABLE`;
 *  * after a failed connect the client fails fast instead of retrying;
 *  * a broker that dies after connecting drops the cached admin so the
 *    next call reconnects.
 */

const connect = vi.fn();
const disconnect = vi.fn(async () => undefined);

vi.mock('kafkajs', () => ({
  Kafka: class {
    admin() {
      return { connect, disconnect };
    }
    producer() {
      return { connect, disconnect };
    }
    consumer() {
      return { connect, disconnect };
    }
  },
}));

async function loadClient() {
  vi.resetModules();
  const mod = await import('@/modules/kafka/repositories/kafka-client');
  return mod.KafkaClient;
}

describe('KafkaClient outage handling', () => {
  beforeEach(() => {
    connect.mockReset();
    disconnect.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('translates an unresolvable broker into a 503 KAFKA_UNAVAILABLE', async () => {
    connect.mockRejectedValue(new Error('Connection error: getaddrinfo ENOTFOUND kafka'));
    const client = await loadClient();

    await expect(client.admin()).rejects.toMatchObject({
      status: 503,
      code: 'KAFKA_UNAVAILABLE',
    });
  });

  it('keeps the original cause in the message so the operator can see why', async () => {
    connect.mockRejectedValue(new Error('Connection error: getaddrinfo ENOTFOUND kafka'));
    const client = await loadClient();

    await expect(client.admin()).rejects.toThrow(/ENOTFOUND kafka/);
  });

  it('fails fast after a failed connect instead of retrying every request', async () => {
    connect.mockRejectedValue(new Error('ECONNREFUSED'));
    const client = await loadClient();

    await expect(client.admin()).rejects.toMatchObject({ code: 'KAFKA_UNAVAILABLE' });
    expect(connect).toHaveBeenCalledTimes(1);

    // Three more requests inside the window: none may touch the network.
    for (let i = 0; i < 3; i += 1) {
      await expect(client.admin()).rejects.toMatchObject({ code: 'KAFKA_UNAVAILABLE' });
    }
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('reconnects once the unavailable window has passed (recovery)', async () => {
    vi.useFakeTimers();
    connect.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(undefined);
    const client = await loadClient();

    await expect(client.admin()).rejects.toMatchObject({ code: 'KAFKA_UNAVAILABLE' });

    vi.advanceTimersByTime(11_000);

    await expect(client.admin()).resolves.toBeDefined();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('disconnects the half-open admin after a failed connect', async () => {
    connect.mockRejectedValue(new Error('ECONNREFUSED'));
    const client = await loadClient();

    await expect(client.admin()).rejects.toBeDefined();
    expect(disconnect).toHaveBeenCalled();
  });

  it('withAdmin turns a raw request failure into a typed 503', async () => {
    connect.mockResolvedValue(undefined);
    const client = await loadClient();

    await expect(
      client.withAdmin(async () => {
        throw new Error('Connection error: ECONNRESET');
      }),
    ).rejects.toMatchObject({ status: 503, code: 'KAFKA_UNAVAILABLE' });
  });

  it('withAdmin passes a successful result through untouched', async () => {
    connect.mockResolvedValue(undefined);
    const client = await loadClient();

    await expect(client.withAdmin(async () => ['orders', 'payments'])).resolves.toEqual([
      'orders',
      'payments',
    ]);
  });

  it('withAdmin drops the cached admin after a failure so the next call reconnects', async () => {
    vi.useFakeTimers();
    connect.mockResolvedValue(undefined);
    const client = await loadClient();

    await client.withAdmin(async () => 'warm');
    expect(connect).toHaveBeenCalledTimes(1);

    await expect(
      client.withAdmin(async () => {
        throw new Error('Connection error: EPIPE');
      }),
    ).rejects.toMatchObject({ code: 'KAFKA_UNAVAILABLE' });

    vi.advanceTimersByTime(11_000);

    await client.withAdmin(async () => 'recovered');
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
