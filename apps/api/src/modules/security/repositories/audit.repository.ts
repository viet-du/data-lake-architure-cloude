import { getMongo } from '@/lib/infra/mongo';
import type { KeysetBoundary } from '@/lib/pagination';
import { AuditEventModel } from './models';

async function ensureConnection(): Promise<void> {
  await getMongo();
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export interface AuditEventRecord {
  eventId: string;
  requestId: string | null;
  principalId: string;
  principalKind: 'user' | 'service' | 'anonymous';
  role: string;
  synthetic: boolean;
  action: string;
  method: string;
  path: string;
  resource: string | null;
  resourceKind: string | null;
  outcome: 'success' | 'failure' | 'denied';
  statusCode: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditListFilter {
  principalId?: string;
  action?: string;
  outcome?: 'success' | 'failure' | 'denied';
  resource?: string;
  /**
   * The keyset position of the last event that was returned.
   *
   * The cursor push-down for the activity feed — see
   * `OperationFilter.before` for the same contract. The boundary is
   * compound (`(createdAt, eventId)`) because several events routinely
   * share one millisecond.
   */
  before?: KeysetBoundary;
  limit: number;
  offset: number;
}

/**
 * Translate a keyset boundary into a MongoDB query fragment.
 *
 * `createdAt` is a BSON `Date` in this collection, so the bound must be a
 * `Date` too. Comparing a `Date` field against an ISO **string** would
 * silently match nothing — MongoDB orders BSON types, and every `Date`
 * sorts before every `String`.
 */
function keysetQuery(
  boundary: KeysetBoundary,
  idField: string,
): Array<Record<string, unknown>> | null {
  switch (boundary.mode) {
    case 'before-at':
      return [{ createdAt: { $lt: new Date(boundary.at) } }];
    case 'at-or-before':
      return [{ createdAt: { $lte: new Date(boundary.at) } }];
    case 'compound':
      return [
        { createdAt: { $lt: new Date(boundary.at) } },
        { createdAt: new Date(boundary.at), [idField]: { $lt: boundary.id } },
      ];
    default:
      return null;
  }
}

export const AuditRepository = {
  async insert(event: Omit<AuditEventRecord, 'createdAt'>): Promise<void> {
    await ensureConnection();
    await AuditEventModel.create({ ...event, createdAt: new Date() });
  },

  async list(filter: AuditListFilter): Promise<{ total: number; items: AuditEventRecord[] }> {
    await ensureConnection();
    const query: Record<string, unknown> = {};
    if (filter.principalId) query.principalId = filter.principalId;
    if (filter.action) query.action = filter.action;
    if (filter.outcome) query.outcome = filter.outcome;
    if (filter.resource) query.resource = filter.resource;
    if (filter.before) {
      // The keyset boundary is pushed down as a lexicographic comparison on
      // `(createdAt, eventId)`.
      const boundary = keysetQuery(filter.before, 'eventId');
      if (boundary) {
        query.$or = [
          ...((query.$or as Array<Record<string, unknown>>) ?? []),
          ...boundary,
        ];
      }
    }
    const [docs, total] = await Promise.all([
      AuditEventModel.find(query)
        .sort({ createdAt: -1, eventId: -1 })
        .skip(filter.offset)
        .limit(filter.limit)
        .lean(),
      AuditEventModel.countDocuments(query),
    ]);
    return {
      total,
      items: docs.map((doc) => {
        const d = doc as unknown as Record<string, unknown>;
        return {
          eventId: d.eventId as string,
          requestId: (d.requestId as string | null) ?? null,
          principalId: d.principalId as string,
          principalKind: d.principalKind as AuditEventRecord['principalKind'],
          role: d.role as string,
          synthetic: (d.synthetic as boolean) ?? false,
          action: d.action as string,
          method: d.method as string,
          path: d.path as string,
          resource: (d.resource as string | null) ?? null,
          resourceKind: (d.resourceKind as string | null) ?? null,
          outcome: d.outcome as AuditEventRecord['outcome'],
          statusCode: (d.statusCode as number) ?? 0,
          durationMs: (d.durationMs as number) ?? 0,
          ...(d.metadata !== undefined && d.metadata !== null
            ? { metadata: d.metadata as Record<string, unknown> }
            : {}),
          createdAt: toIso(d.createdAt),
        };
      }),
    };
  },

  async countByAction(since: Date): Promise<Array<{ action: string; count: number }>> {
    await ensureConnection();
    const rows = await AuditEventModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return rows.map((row) => ({ action: row._id, count: row.count }));
  },
};
