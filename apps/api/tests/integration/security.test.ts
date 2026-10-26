import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { RouteHandler } from '@/middlewares';
import type { AuditEventInput } from '@/modules/security/types';

const ORIGINAL_ENV: Record<string, string | undefined> = {
  API_AUTH_ENABLED: process.env.API_AUTH_ENABLED,
  API_RATE_LIMIT_PER_MIN: process.env.API_RATE_LIMIT_PER_MIN,
  API_SERVICE_KEYS: process.env.API_SERVICE_KEYS,
  API_USER_CREDENTIALS: process.env.API_USER_CREDENTIALS,
};

/**
 * Restore an environment variable to its original value.
 *
 * Assigning `undefined` to `process.env` stores the *string* `"undefined"`,
 * which would then fail the Zod environment schema and break every test
 * file that runs afterwards in the same worker process.
 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

const redisCounters = new Map<string, number>();

interface Harness {
  withSecurity: (handler: RouteHandler) => RouteHandler;
  auditRecord: ReturnType<typeof vi.fn<(input: AuditEventInput) => Promise<void>>>;
  issueSessionToken: (input: {
    principalId: string;
    role: 'viewer' | 'analyst' | 'operator' | 'admin';
    scopes: string[];
  }) => { token: string; expiresAt: number };
  issueConfirmToken: (input: {
    principalId: string;
    action: string;
    resource: string;
  }) => { token: string; expiresAt: number };
}

async function loadHarness(options: {
  authEnabled: boolean;
  rateLimitPerMin?: number;
  serviceKeys?: string;
  userCredentials?: string;
}): Promise<Harness> {
  vi.resetModules();
  process.env.API_AUTH_ENABLED = options.authEnabled ? 'true' : 'false';
  process.env.API_RATE_LIMIT_PER_MIN = String(options.rateLimitPerMin ?? 600);
  process.env.API_SERVICE_KEYS = options.serviceKeys ?? '';
  process.env.API_USER_CREDENTIALS = options.userCredentials ?? '';

  vi.doMock('@/lib/infra/redis', () => ({
    getRedis: () => ({
      incr: async (key: string) => {
        const next = (redisCounters.get(key) ?? 0) + 1;
        redisCounters.set(key, next);
        return next;
      },
      expire: async () => 1,
    }),
    closeRedis: async () => undefined,
  }));

  const auditModule = await import('@/modules/security/services/audit.service');
  const auditRecord = vi.fn(async (_input: AuditEventInput) => {});
  auditModule.AuditService.record = auditRecord;

  const middlewares = await import('@/middlewares');
  const tokenService = await import('@/modules/security/services/token.service');

  return {
    withSecurity: middlewares.withSecurity,
    auditRecord,
    issueSessionToken: tokenService.issueSessionToken,
    issueConfirmToken: tokenService.issueConfirmToken,
  };
}

function jsonRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method, headers });
}

const TOPIC_PRODUCE_PATH = '/api/kafka/topics/orders/produce';
const TOPIC_DELETE_PATH = '/api/kafka/topics/orders';
const DAG_TRIGGER_PATH = '/api/airflow/dags/retail_elt_dag/trigger';

afterEach(() => {
  vi.doUnmock('@/lib/infra/redis');
  vi.resetModules();
  redisCounters.clear();
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    restoreEnv(key, value);
  }
});

describe('P0-AUTH-01 — viewer / anonymous cannot mutate', () => {
  it('rejects an anonymous mutation with 401 and never reaches the handler', async () => {
    const { withSecurity, auditRecord } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);

    const response = await guarded(jsonRequest('POST', TOPIC_PRODUCE_PATH), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: string; details?: { reasonCode?: string } };
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.details?.reasonCode).toBe('MISSING_CREDENTIAL');
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'denied',
      statusCode: 401,
    });
  });

  it('rejects a viewer produce with 403 and no side effect', async () => {
    const { withSecurity, auditRecord, issueSessionToken } = await loadHarness({
      authEnabled: true,
    });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({ principalId: 'viewer-1', role: 'viewer', scopes: [] });

    const response = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      {},
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: string; details?: { reasonCode?: string } };
    expect(body.error).toBe('FORBIDDEN');
    expect(body.details?.reasonCode).toBe('INSUFFICIENT_ROLE');
    expect(auditRecord.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'denied',
      principal: { principalId: 'viewer-1', kind: 'user', role: 'viewer' },
      action: 'kafka:produce',
    });
  });

  it('rejects a viewer topic delete with 403 and no side effect', async () => {
    const { withSecurity, issueSessionToken } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({ principalId: 'viewer-1', role: 'viewer', scopes: [] });

    const response = await guarded(
      jsonRequest('DELETE', TOPIC_DELETE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects a viewer DAG trigger with 403 and no side effect', async () => {
    const { withSecurity, issueSessionToken } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({ principalId: 'viewer-1', role: 'viewer', scopes: [] });

    const response = await guarded(
      jsonRequest('POST', DAG_TRIGGER_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { dagId: 'retail_elt_dag' } },
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('P0-AUTH-02 — permitted mutation is executed, audited and rate limited', () => {
  it('executes an operator mutation and records the actor in the audit trail', async () => {
    const { withSecurity, auditRecord, issueSessionToken } = await loadHarness({
      authEnabled: true,
    });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({
      principalId: 'operator-1',
      role: 'operator',
      scopes: [],
    });

    const response = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'success',
      statusCode: 201,
      principal: { principalId: 'operator-1', kind: 'user', role: 'operator' },
      action: 'kafka:produce',
      method: 'POST',
      path: TOPIC_PRODUCE_PATH,
      resource: 'orders',
    });
  });

  it('rejects an operator whose scope does not cover the target resource', async () => {
    const { withSecurity, issueSessionToken } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({
      principalId: 'operator-1',
      role: 'operator',
      scopes: ['retail.*'],
    });

    const response = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = (await response.json()) as { details?: { reasonCode?: string } };
    expect(body.details?.reasonCode).toBe('OUT_OF_SCOPE');
  });

  it('allows an operator whose scope covers the target resource', async () => {
    const { withSecurity, issueSessionToken } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({
      principalId: 'operator-1',
      role: 'operator',
      scopes: ['orders'],
    });

    const response = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('enforces the request budget per identity and stops calling the handler', async () => {
    const { withSecurity, issueSessionToken } = await loadHarness({
      authEnabled: true,
      rateLimitPerMin: 2,
    });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({
      principalId: 'operator-1',
      role: 'operator',
      scopes: [],
    });

    const first = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );
    const second = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );
    const third = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(handler).toHaveBeenCalledTimes(2);
    const body = (await third.json()) as { error: string };
    expect(body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('requires a server-side confirmation token for a destructive admin action', async () => {
    const { withSecurity, issueSessionToken, issueConfirmToken } = await loadHarness({
      authEnabled: true,
    });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({ principalId: 'admin-1', role: 'admin', scopes: [] });

    const withoutToken = await guarded(
      jsonRequest('DELETE', TOPIC_DELETE_PATH, { authorization: `Bearer ${session.token}` }),
      { params: { topic: 'orders' } },
    );
    expect(withoutToken.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const body = (await withoutToken.json()) as { details?: { reasonCode?: string } };
    expect(body.details?.reasonCode).toBe('CONFIRMATION_REQUIRED');

    const confirm = issueConfirmToken({
      principalId: 'admin-1',
      action: 'kafka:topic:delete',
      resource: 'orders',
    });
    const withToken = await guarded(
      jsonRequest('DELETE', TOPIC_DELETE_PATH, {
        authorization: `Bearer ${session.token}`,
        'x-confirm-token': confirm.token,
      }),
      { params: { topic: 'orders' } },
    );
    expect(withToken.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects a confirmation token that was issued for a different resource', async () => {
    const { withSecurity, issueSessionToken, issueConfirmToken } = await loadHarness({
      authEnabled: true,
    });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);
    const session = issueSessionToken({ principalId: 'admin-1', role: 'admin', scopes: [] });
    const confirm = issueConfirmToken({
      principalId: 'admin-1',
      action: 'kafka:topic:delete',
      resource: 'payments',
    });

    const response = await guarded(
      jsonRequest('DELETE', TOPIC_DELETE_PATH, {
        authorization: `Bearer ${session.token}`,
        'x-confirm-token': confirm.token,
      }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('authenticates a service credential as a service principal, not a user', async () => {
    const secret = 'qa-service-secret-value';
    const secretHash = createHash('sha256').update(secret, 'utf8').digest('hex');
    const { withSecurity, auditRecord } = await loadHarness({
      authEnabled: true,
      serviceKeys: JSON.stringify([
        {
          keyId: 'svc-1',
          secretHash,
          principalId: 'svc-1',
          role: 'operator',
          scopes: [],
        },
      ]),
    });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);

    const response = await guarded(
      jsonRequest('POST', TOPIC_PRODUCE_PATH, { 'x-service-key': `svc-1:${secret}` }),
      { params: { topic: 'orders' } },
    );

    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(auditRecord.mock.calls[0]?.[0]).toMatchObject({
      principal: { principalId: 'svc-1', kind: 'service', role: 'operator' },
    });
  });

  it('keeps a public route reachable without a credential', async () => {
    const { withSecurity } = await loadHarness({ authEnabled: true });
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);

    const response = await guarded(jsonRequest('GET', '/api/health'), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows every route when authentication is disabled (local development)', async () => {
    const { withSecurity } = await loadHarness({ authEnabled: false });
    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const guarded = withSecurity(handler as unknown as RouteHandler);

    const response = await guarded(jsonRequest('POST', TOPIC_PRODUCE_PATH), {});

    expect(response.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
