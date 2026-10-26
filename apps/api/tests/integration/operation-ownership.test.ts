import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The operation ownership check.
 *
 * MASTER PLAN §05.4 requires a destructive action to be enforced by the
 * *backend* and to display "exact resource + effects + ownership". The
 * role check in the auth middleware answers "may this principal cancel a
 * job at all"; the check here answers "may this principal cancel *this*
 * job".
 */

const baseOperation = {
  operationId: 'op_1',
  kind: 'bronze.ingest' as const,
  status: 'running' as const,
  executionTarget: 'local_delta_minio' as const,
  datasets: [],
  ownerId: 'alice',
  ownerKind: 'user',
  traceId: 'trace_1',
  attempt: 1,
  correlation: {},
  progress: 50,
  metrics: {},
  cancellable: true,
  retryable: true,
  createdAt: '2026-10-25T06:00:00.000Z',
};

describe('operation ownership', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('allows the owner to cancel their own operation', async () => {
    const { OperationService } = await import('@/modules/operations/services/operation.service');
    expect(() =>
      OperationService.assertOwner(baseOperation, {
        principalId: 'alice',
        principalKind: 'user',
      }),
    ).not.toThrow();
  });

  it('refuses to let another user cancel the operation', async () => {
    const { OperationService } = await import('@/modules/operations/services/operation.service');
    expect(() =>
      OperationService.assertOwner(baseOperation, {
        principalId: 'mallory',
        principalKind: 'user',
      }),
    ).toThrowError(/another principal/i);
  });

  it('does not bind a service principal to a user', async () => {
    const { OperationService } = await import('@/modules/operations/services/operation.service');
    // A service acts for the platform, not for one user.
    expect(() =>
      OperationService.assertOwner(baseOperation, {
        principalId: 'airflow-service',
        principalKind: 'service',
      }),
    ).not.toThrow();
  });

  it('does not lock out the synthetic principal when auth is disabled', async () => {
    const { OperationService } = await import('@/modules/operations/services/operation.service');
    // The synthetic principal is `anonymous` — an ownership check it can
    // never satisfy would make the API unusable with auth disabled.
    expect(() =>
      OperationService.assertOwner(baseOperation, {
        principalId: 'anonymous',
        principalKind: 'anonymous',
      }),
    ).not.toThrow();
  });
});
