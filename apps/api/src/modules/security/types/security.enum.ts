/**
 * Security vocabulary.
 *
 * MASTER PLAN §13.1 requires at least four roles with clearly separated
 * authority:
 *
 *   * Viewer   — read-only
 *   * Analyst  — run EDA/DQ, view masked samples
 *   * Operator — trigger pipelines / manage topics within scope
 *   * Admin    — destructive actions, policy gates
 *
 * Permissions are action-level so that a role map can be reasoned about
 * without reading the route table. The route table itself lives in
 * `policy.service.ts` and maps every mutating route onto exactly one
 * permission.
 */

export const SECURITY_ROLES = ['viewer', 'analyst', 'operator', 'admin'] as const;
export type SecurityRole = (typeof SECURITY_ROLES)[number];

export const SECURITY_PERMISSIONS = [
  'system:read',
  'dataset:read',
  'dataset:sample',
  'dataset:profile',
  'dataset:dq',
  'dataset:export',
  'ingestion:run',
  'pipeline:run',
  'catalog:sync',
  'catalog:write',
  'catalog:delete',
  'dq:rule:manage',
  'dq:rule:delete',
  'kafka:read',
  'kafka:produce',
  'kafka:topic:manage',
  'kafka:topic:delete',
  'kafka:consumer:delete',
  'kafka:offset:reset',
  'airflow:read',
  'airflow:trigger',
  'airflow:dag:manage',
  'airflow:run:cancel',
  'crawler:run',
  'crawler:config:manage',
  'retention:vacuum',
  'partition:delete',
  'job:cancel',
  'user:manage',
  'audit:read',
] as const;
export type SecurityPermission = (typeof SECURITY_PERMISSIONS)[number];

export const PRINCIPAL_KINDS = ['user', 'service', 'anonymous'] as const;
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

export const AUDIT_OUTCOMES = ['success', 'failure', 'denied'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/**
 * Role → permission map.
 *
 * `viewer` is deliberately limited to metadata reads: raw sample rows may
 * contain PII, so they require `dataset:sample` (analyst and above).
 */
export const ROLE_PERMISSIONS: Readonly<Record<SecurityRole, readonly SecurityPermission[]>> = {
  viewer: [
    'system:read',
    'dataset:read',
    'kafka:read',
    'airflow:read',
  ],
  analyst: [
    'system:read',
    'dataset:read',
    'dataset:sample',
    'dataset:profile',
    'dataset:dq',
    'dq:rule:manage',
    'kafka:read',
    'airflow:read',
  ],
  operator: [
    'system:read',
    'dataset:read',
    'dataset:sample',
    'dataset:profile',
    'dataset:dq',
    'dataset:export',
    'ingestion:run',
    'pipeline:run',
    'catalog:sync',
    'dq:rule:manage',
    'kafka:read',
    'kafka:produce',
    'kafka:topic:manage',
    'airflow:read',
    'airflow:trigger',
    'airflow:run:cancel',
    'crawler:run',
    'crawler:config:manage',
    'job:cancel',
  ],
  admin: [
    'system:read',
    'dataset:read',
    'dataset:sample',
    'dataset:profile',
    'dataset:dq',
    'dataset:export',
    'ingestion:run',
    'pipeline:run',
    'catalog:sync',
    'catalog:write',
    'catalog:delete',
    'dq:rule:manage',
    'dq:rule:delete',
    'kafka:read',
    'kafka:produce',
    'kafka:topic:manage',
    'kafka:topic:delete',
    'kafka:consumer:delete',
    'kafka:offset:reset',
    'airflow:read',
    'airflow:trigger',
    'airflow:dag:manage',
    'airflow:run:cancel',
    'crawler:run',
    'crawler:config:manage',
    'retention:vacuum',
    'partition:delete',
    'job:cancel',
    'user:manage',
    'audit:read',
  ],
};

export const ADMIN_PERMISSIONS: readonly SecurityPermission[] = ROLE_PERMISSIONS.admin;
