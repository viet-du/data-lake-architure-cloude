import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AUDIT_EVENT_PREFIX,
  OPERATION_EVENT_PREFIX,
  sourceBoundary,
} from '@/lib/pagination';

/**
 * The activity feed's cursor pagination contract.
 *
 * MASTER PLAN §08.2: the feed is "ordered real events; cursor, hasMore".
 * The dangerous failure mode is *silent data loss* — a page boundary that
 * drops the events between the two sources, or one that repeats an event.
 * Both are invisible in a status-code check, so they are asserted here.
 */

const timestamp = '2026-10-25T06:50:45.529Z';

/** Decode the opaque cursor the way the service does. */
function decodeCursor(cursor: string): { at: string; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
    at: string;
    id: string;
  };
}

function encodeCursor(value: { at: string; id: string }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

describe('dashboard activity cursor contract', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('source boundary derivation', () => {
    it('uses a compound boundary when the cursor points into the same source', () => {
      expect(
        sourceBoundary({ at: timestamp, id: 'audit:evt_2' }, AUDIT_EVENT_PREFIX),
      ).toEqual({ mode: 'compound', at: timestamp, id: 'evt_2' });

      expect(
        sourceBoundary({ at: timestamp, id: 'op:op_1' }, OPERATION_EVENT_PREFIX),
      ).toEqual({ mode: 'compound', at: timestamp, id: 'op_1' });
    });

    it('derives a timestamp-only boundary when the cursor points into the other source', () => {
      // The global order is `(at DESC, id DESC)` and the id is
      // source-prefixed. `op:` sorts *after* `audit:`, so an operation row
      // at the cursor's instant sorts *before* the cursor and was already
      // consumed — only the strictly older rows remain.
      expect(
        sourceBoundary({ at: timestamp, id: 'audit:evt_2' }, OPERATION_EVENT_PREFIX),
      ).toEqual({ mode: 'before-at', at: timestamp });

      // The cursor is an operation event; `audit:` sorts *before* `op:`, so
      // the audit rows at that instant belong to the next page.
      expect(
        sourceBoundary({ at: timestamp, id: 'op:op_1' }, AUDIT_EVENT_PREFIX),
      ).toEqual({ mode: 'at-or-before', at: timestamp });
    });

    it('returns no boundary for the first page', () => {
      expect(sourceBoundary(null, AUDIT_EVENT_PREFIX)).toBeNull();
      expect(sourceBoundary(undefined, OPERATION_EVENT_PREFIX)).toBeNull();
    });
  });

  it('pushes the cursor bound down to both sources and keeps the page boundary exact', async () => {
    const operations = [
      {
        operationId: 'op_1',
        kind: 'bronze.ingest' as const,
        status: 'succeeded' as const,
        executionTarget: 'local_delta_minio' as const,
        datasets: [
          {
            provider: 'local_delta_minio',
            layer: 'bronze',
            database: 'erp',
            table: 'orders',
            datasetId: 'local_delta_minio/bronze.erp.orders',
          },
        ],
        ownerId: 'anonymous',
        ownerKind: 'anonymous',
        traceId: 'trace_1',
        attempt: 1,
        correlation: {},
        progress: 100,
        metrics: {},
        cancellable: true,
        retryable: true,
        createdAt: '2026-10-25T06:00:00.000Z',
        startedAt: '2026-10-25T06:00:00.000Z',
        finishedAt: '2026-10-25T06:00:01.000Z',
      },
    ];

    const listSpy = vi.fn().mockResolvedValue({ operations, total: operations.length });
    const auditSpy = vi.fn().mockResolvedValue({
      total: 2,
      items: [
        {
          eventId: 'evt_1',
          requestId: null,
          principalId: 'anonymous',
          principalKind: 'anonymous' as const,
          role: 'viewer',
          synthetic: true,
          action: 'pipeline:run',
          method: 'POST',
          path: '/api/operations',
          resource: null,
          resourceKind: null,
          outcome: 'success' as const,
          statusCode: 202,
          durationMs: 3,
          createdAt: timestamp,
        },
        {
          eventId: 'evt_2',
          requestId: null,
          principalId: 'anonymous',
          principalKind: 'anonymous' as const,
          role: 'viewer',
          synthetic: true,
          action: 'pipeline:run',
          method: 'POST',
          path: '/api/operations',
          resource: null,
          resourceKind: null,
          outcome: 'success' as const,
          statusCode: 202,
          durationMs: 3,
          createdAt: timestamp,
        },
      ],
    });

    vi.doMock('@/modules/operations/repositories', () => ({
      OperationRepository: { list: listSpy },
    }));
    vi.doMock('@/modules/security/services', () => ({
      AuditService: { list: auditSpy },
    }));

    const { DashboardService } = await import('@/modules/dashboard/services/dashboard.service');

    // ── Page 1 ──────────────────────────────────────────────────────────
    const page1 = await DashboardService.activity({ limit: 2 });
    expect(page1.count).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // Both sources were read.
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
    // The first page has no cursor bound.
    expect(listSpy.mock.calls[0]?.[0]).not.toHaveProperty('before');
    expect(auditSpy.mock.calls[0]?.[0]).not.toHaveProperty('before');

    // The page is ordered newest-first.
    const page1Times = page1.activity.map((event) => event.at);
    expect([...page1Times].sort().reverse()).toEqual(page1Times);

    // ── Page 2 ──────────────────────────────────────────────────────────
    // The cursor points at the *last* item of page 1. The two audit events
    // share a timestamp, so the tie is broken by the id — descending, which
    // puts `evt_2` first and `evt_1` last.
    const cursor = decodeCursor(page1.nextCursor as string);
    expect(cursor.at).toBe(timestamp);
    expect(cursor.id).toBe('audit:evt_1');

    const page2 = await DashboardService.activity({ limit: 2, cursor: page1.nextCursor });
    expect(page2.count).toBe(1);

    // The bound was pushed down to *both* sources, each with the boundary
    // that matches its own source.
    expect(listSpy.mock.calls[1]?.[0]).toMatchObject({
      before: { mode: 'before-at', at: timestamp },
    });
    expect(auditSpy.mock.calls[1]?.[0]).toMatchObject({
      before: { mode: 'compound', at: timestamp, id: 'evt_1' },
    });

    // No event is repeated across the page boundary.
    const page1Ids = new Set(page1.activity.map((event) => event.id));
    for (const event of page2.activity) {
      expect(page1Ids.has(event.id)).toBe(false);
    }

    // No event is lost: the union of both pages holds every source event.
    const allIds = new Set(
      [...page1.activity, ...page2.activity].map((event) => event.id),
    );
    expect(allIds.has('audit:evt_1')).toBe(true);
    expect(allIds.has('audit:evt_2')).toBe(true);
    expect(allIds.has('op:op_1')).toBe(true);
    expect(allIds.size).toBe(3);
  });

  it('treats a malformed cursor as no cursor instead of failing the request', async () => {
    vi.doMock('@/modules/operations/repositories', () => ({
      OperationRepository: { list: vi.fn().mockResolvedValue({ operations: [], total: 0 }) },
    }));
    vi.doMock('@/modules/security/services', () => ({
      AuditService: { list: vi.fn().mockResolvedValue({ total: 0, items: [] }) },
    }));

    const { DashboardService } = await import('@/modules/dashboard/services/dashboard.service');
    const result = await DashboardService.activity({ limit: 5, cursor: 'not-a-cursor' });
    expect(result.count).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('reports a partial feed when one source cannot be read', async () => {
    vi.doMock('@/modules/operations/repositories', () => ({
      OperationRepository: {
        list: vi.fn().mockRejectedValue(new Error('mongo down')),
      },
    }));
    vi.doMock('@/modules/security/services', () => ({
      AuditService: { list: vi.fn().mockResolvedValue({ total: 0, items: [] }) },
    }));

    const { DashboardService } = await import('@/modules/dashboard/services/dashboard.service');
    const result = await DashboardService.activity({ limit: 5 });
    expect(result.partial).toBe(true);
    expect(result.partialFailures?.[0]?.metric).toBe('activity.operations');
    expect(result.count).toBe(0);
  });

  it('encodes the cursor so that the next page starts strictly after the last item', () => {
    const cursor = encodeCursor({ at: timestamp, id: 'audit:evt_2' });
    // base64url — no padding, no characters that need URL escaping.
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual({ at: timestamp, id: 'audit:evt_2' });
  });
});
