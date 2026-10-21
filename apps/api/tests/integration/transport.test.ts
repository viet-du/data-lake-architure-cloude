import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

describe('HTTP transport', () => {
  it('allows configured origins and answers preflight', async () => {
    const { withCors } = await import('@/middlewares/with-cors');
    const { env } = await import('@/config');
    const origin = env.API_CORS_ORIGINS.split(',')[0]!;
    const handler = withCors(() => NextResponse.json({ data: [] }));
    const response = await handler(new NextRequest('http://localhost/api/catalog/databases', { method: 'OPTIONS', headers: { origin } }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
  it('does not grant cross-origin access to an unknown origin', async () => {
    const { withCors } = await import('@/middlewares/with-cors');
    const response = await withCors(() => NextResponse.json({ data: [] }))(new NextRequest('http://localhost/api/health', { headers: { origin: 'https://untrusted.example' } }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('preserves application error status and wire shape', async () => {
    const { withErrorHandler } = await import('@/middlewares/with-error-handler');
    const { AppError } = await import('@/errors');
    const response = await withErrorHandler(() => { throw new AppError(503, 'AIRFLOW_UNREACHABLE', 'Airflow unavailable'); })(new NextRequest('http://localhost/api/airflow/dags'), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'AIRFLOW_UNREACHABLE', message: 'Airflow unavailable' });
  });
});
