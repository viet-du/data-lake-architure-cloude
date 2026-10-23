import { describe, it, expect, vi } from 'vitest';
import type { BronzeJobPayload } from '@/modules/bronze/queues/bronze.queue';

const { update } = vi.hoisted(() => ({ update: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/bronze/repositories', () => ({ BronzeJobRepository: { update } }));

describe('Bronze shared queue dispatch', () => {
  it.each(['csv', 'json', 'stream'] as const)('records %s executor failure instead of acknowledging a different kind', async (kind) => {
    update.mockClear();
    const { processBronzeJob } = await import('@/modules/bronze/workers/bronze.worker');
    const payload: BronzeJobPayload = {
      jobId: `fixture-${kind}`, database: 'test', table: 'fixture', kind,
      source: 'fixture.csv', topic: 'fixture', startedAt: '2026-10-21T00:00:00Z',
    };
    await expect(processBronzeJob(payload, 1)).rejects.toThrow('no data was written');
    expect(update).toHaveBeenCalledWith(payload.jobId, { status: 'running', attemptsMade: 1 });
    expect(update).toHaveBeenLastCalledWith(payload.jobId, expect.objectContaining({ status: 'failed' }));
    expect(update.mock.calls.some(([, value]) => value.status === 'completed')).toBe(false);
  });
});
