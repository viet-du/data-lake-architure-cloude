import { afterEach, describe, expect, it, vi } from 'vitest';
import { AirflowClient } from '@/modules/airflow/repositories/airflow-client';

afterEach(() => vi.unstubAllGlobals());

describe('Airflow upstream transport failures', () => {
  it.each([401, 403])('preserves upstream authentication status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Denied' }), { status })));
    await expect(new AirflowClient().request({ method: 'GET', path: '/dags' })).rejects.toMatchObject({ status, code: 'AIRFLOW_UPSTREAM_ERROR' });
  });
  it('reports an unavailable upstream as 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(new AirflowClient().request({ method: 'GET', path: '/dags' })).rejects.toMatchObject({ status: 503, code: 'AIRFLOW_UNREACHABLE' });
  });
  it('reports upstream HTTP 500 as dependency unavailability', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 500 })));
    await expect(new AirflowClient().request({ method: 'GET', path: '/dags' })).rejects.toMatchObject({ status: 503 });
  });
});
