import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirflowRequestOptions } from '@/modules/airflow/repositories/airflow-client';

const { request } = vi.hoisted(() => ({ request: vi.fn<(options: AirflowRequestOptions) => Promise<unknown>>() }));
vi.mock('@/modules/airflow/repositories/airflow-client', () => ({ AirflowClientSingleton: { get: () => ({ request }) } }));

describe('Airflow stats against supported API paths', () => {
  beforeEach(() => { request.mockReset(); });
  it('uses state-filtered collection totals instead of an unavailable statistics endpoint', async () => {
    const counts: Record<string, number> = { running: 2, failed: 3, success: 105, queued: 1 };
    request.mockImplementation(async ({ path, query }) => path === '/dags'
      ? { dags: [], total_entries: 0 }
      : { dag_runs: [], total_entries: counts[String(query?.state)] });
    const { AirflowClusterRepository } = await import('@/modules/airflow/repositories/airflow.repository');
    expect(await AirflowClusterRepository.stats()).toMatchObject({ totalDags: 0, runningRuns: 2, failedRuns: 3, successRuns: 105, queuedRuns: 1 });
    expect(request).toHaveBeenCalledWith({ method: 'GET', path: '/dags/~/dagRuns', query: { limit: 1, offset: 0, state: 'success' } });
  });
  it('propagates failed count requests rather than returning fabricated zero totals', async () => {
    request.mockImplementation(async ({ path }) => {
      if (path === '/dags') return { dags: [], total_entries: 0 };
      throw new Error('upstream denied');
    });
    const { AirflowClusterRepository } = await import('@/modules/airflow/repositories/airflow.repository');
    await expect(AirflowClusterRepository.stats()).rejects.toThrow('upstream denied');
  });
});
