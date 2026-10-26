import { randomUUID } from 'node:crypto';
import { env } from '@/config';
import { logger } from '@/lib/logger';
import { AuditRepository, type AuditEventRecord, type AuditListFilter } from '../repositories';
import type { AuditEvent, AuditEventInput, Principal } from '../types';

/**
 * Audit trail.
 *
 * MASTER PLAN §13.9 requires an append-only ledger for operations, DQ
 * changes, gate overrides, topic/offset admin actions, dataset export and
 * user actions.
 *
 * Two rules are enforced here:
 *
 *  * **No raw payloads.** Only metadata that the caller explicitly marks as
 *    safe is persisted. Request bodies and Kafka message bodies are never
 *    written to the ledger (MASTER PLAN §13.3).
 *  * **Never fatal.** A failing audit write must not break the business
 *    operation that was being audited; the failure is logged instead.
 */

const auditLogger = logger.child({ module: 'audit' });

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const blocked = /password|secret|token|authorization|cookie|body|payload|message/i;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.test(key)) continue;
    if (typeof value === 'string' && value.length > 256) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export const AuditService = {
  /** Record an audited action. Failures are swallowed and logged. */
  async record(input: AuditEventInput): Promise<void> {
    if (!env.API_AUDIT_ENABLED) return;
    const event: Omit<AuditEventRecord, 'createdAt'> = {
      eventId: randomUUID(),
      requestId: input.requestId,
      principalId: input.principal.principalId,
      principalKind: input.principal.kind,
      role: input.principal.role,
      synthetic: input.principal.synthetic,
      action: input.action,
      method: input.method,
      path: input.path,
      resource: input.resource,
      resourceKind: input.resourceKind,
      outcome: input.outcome,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      ...(sanitizeMetadata(input.metadata) ? { metadata: sanitizeMetadata(input.metadata) } : {}),
    };
    try {
      await AuditRepository.insert(event);
    } catch (error) {
      auditLogger.error(
        { err: error, action: input.action, path: input.path },
        'Failed to persist audit event',
      );
    }
  },

  async list(filter: AuditListFilter): Promise<{ total: number; items: AuditEvent[] }> {
    const result = await AuditRepository.list(filter);
    return {
      total: result.total,
      // The repository already resolves `createdAt` from the persisted
      // document. Re-stamping it with "now" here would make every event
      // look simultaneous and would break the activity feed ordering.
      items: result.items.map((item) => ({ ...item })),
    };
  },

  /** Convenience helper for building a synthetic principal record. */
  describePrincipal(principal: Principal): string {
    return `${principal.principalId} (${principal.kind}/${principal.role})`;
  },
};
