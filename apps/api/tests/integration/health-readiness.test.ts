import { describe, expect, it } from 'vitest';
import { airflowReadiness } from '@/modules/health/services/health.service';

describe('Airflow deep health readiness', () => {
  it('requires healthy scheduler and metadata database', () => {
    expect(airflowReadiness({ metadatabase: { status: 'healthy' }, scheduler: { status: 'healthy' } })).toBe('up');
    expect(airflowReadiness({ metadatabase: { status: 'healthy' }, scheduler: { status: 'unhealthy' } })).toBe('down');
  });
  it('does not treat arbitrary HTTP 200 content as dependency readiness', () => {
    expect(airflowReadiness({})).toBe('down');
    expect(airflowReadiness({ metadatabase: { status: 'unhealthy' }, scheduler: { status: 'healthy' } })).toBe('down');
  });
});
