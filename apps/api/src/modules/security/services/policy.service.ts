import type { RoutePolicy, ResourceKind, SecurityPermission } from '../types';

/**
 * Route → permission policy table.
 *
 * MASTER PLAN §13.1: "Authorize per provider/dataset/operation". The table
 * below is the single place that decides which permission a route needs; the
 * middleware never hard-codes a permission for an individual route file.
 *
 * Rules are matched in order — the first matching entry wins. Read routes are
 * listed before the more specific mutation routes so that a generic prefix
 * cannot accidentally authorise a destructive path.
 */

interface PolicyRule extends RoutePolicy {
  method: string;
  pattern: RegExp;
}

const READ = 'dataset:read' as const;
const SAMPLE = 'dataset:sample' as const;

/** Build a rule for a literal path prefix (optionally with a trailing regex). */
function rule(
  method: string,
  pattern: RegExp,
  permission: SecurityPermission,
  options: { destructive?: boolean; resource?: ResourceKind; resourceParam?: string } = {},
): PolicyRule {
  return {
    method,
    pattern,
    permission,
    destructive: options.destructive ?? false,
    ...(options.resource ? { resource: options.resource } : {}),
    ...(options.resourceParam ? { resourceParam: options.resourceParam } : {}),
  };
}

const POLICY_RULES: readonly PolicyRule[] = [
  // ── Health / info ────────────────────────────────────────────────────────
  rule('GET', /^\/api\/(health|info)(\/deep)?$/, 'system:read'),

  // ── Auth ────────────────────────────────────────────────────────────────
  rule('POST', /^\/api\/auth\/(login|confirm)$/, 'system:read'),

  // ── Control-plane users ────────────────────────────────────────────────
  rule('PUT', /^\/api\/users\/[^/]+$/, 'user:manage', {
    resource: 'user',
    resourceParam: 'userId',
  }),
  rule('POST', /^\/api\/users$/, 'user:manage', { resource: 'user' }),
  rule('GET', /^\/api\/users/, 'user:manage'),

  // ── Audit ledger ───────────────────────────────────────────────────────
  rule('GET', /^\/api\/audit/, 'audit:read'),

  // ── Catalog ─────────────────────────────────────────────────────────────
  rule('GET', /^\/api\/catalog\/tables\/[^/]+\/sample$/, SAMPLE),
  rule('POST', /^\/api\/catalog\/tables\/[^/]+\/sync$/, 'catalog:sync'),
  rule('PUT', /^\/api\/catalog\/tables\/[^/]+$/, 'catalog:write'),
  rule('DELETE', /^\/api\/catalog\/tables\/[^/]+$/, 'catalog:delete', {
    destructive: true,
    resource: 'table',
    resourceParam: 'tableId',
  }),
  rule('POST', /^\/api\/catalog\/databases$/, 'catalog:write'),
  rule('DELETE', /^\/api\/catalog\/databases\/[^/]+$/, 'catalog:delete', {
    destructive: true,
    resource: 'database',
    resourceParam: 'db',
  }),
  rule('GET', /^\/api\/catalog\//, READ),

  // ── Bronze ──────────────────────────────────────────────────────────────
  rule('GET', /^\/api\/bronze\/[^/]+\/sample$/, SAMPLE),
  rule('POST', /^\/api\/bronze\/ingest\//, 'ingestion:run', { resource: 'dataset' }),
  rule('POST', /^\/api\/bronze\/[^/]+\/vacuum$/, 'retention:vacuum', {
    destructive: true,
    resource: 'table',
    resourceParam: 'table',
  }),
  rule('DELETE', /^\/api\/bronze\/[^/]+\/partitions\/[^/]+$/, 'partition:delete', {
    destructive: true,
    resource: 'partition',
    resourceParam: 'date',
  }),
  rule('DELETE', /^\/api\/bronze\/jobs\/[^/]+$/, 'job:cancel', {
    resource: 'job',
    resourceParam: 'jobId',
  }),
  rule('GET', /^\/api\/bronze\//, READ),

  // ── Silver ──────────────────────────────────────────────────────────────
  rule('GET', /^\/api\/silver\/[^/]+\/sample$/, SAMPLE),
  rule('POST', /^\/api\/silver\/transform\/all$/, 'pipeline:run', { resource: 'dataset' }),
  rule('POST', /^\/api\/silver\/[^/]+\/(transform|refresh)$/, 'pipeline:run', {
    resource: 'table',
    resourceParam: 'table',
  }),
  rule('DELETE', /^\/api\/silver\/jobs\/[^/]+$/, 'job:cancel', {
    resource: 'job',
    resourceParam: 'jobId',
  }),
  rule('GET', /^\/api\/silver\//, READ),

  // ── Gold ────────────────────────────────────────────────────────────────
  rule('GET', /^\/api\/gold\/[^/]+\/sample$/, SAMPLE),
  rule('POST', /^\/api\/gold\/aggregate\/all$/, 'pipeline:run', { resource: 'dataset' }),
  rule('POST', /^\/api\/gold\/[^/]+\/(aggregate|refresh)$/, 'pipeline:run', {
    resource: 'table',
    resourceParam: 'table',
  }),
  rule('DELETE', /^\/api\/gold\/jobs\/[^/]+$/, 'job:cancel', {
    resource: 'job',
    resourceParam: 'jobId',
  }),
  rule('GET', /^\/api\/gold\//, READ),

  // ── Kafka ───────────────────────────────────────────────────────────────
  rule('POST', /^\/api\/kafka\/topics\/[^/]+\/produce(-batch)?$/, 'kafka:produce', {
    resource: 'topic',
    resourceParam: 'topic',
  }),
  rule('DELETE', /^\/api\/kafka\/topics\/[^/]+$/, 'kafka:topic:delete', {
    destructive: true,
    resource: 'topic',
    resourceParam: 'topic',
  }),
  rule('POST', /^\/api\/kafka\/topics$/, 'kafka:topic:manage', { resource: 'topic' }),
  rule('DELETE', /^\/api\/kafka\/consumer-groups\/[^/]+$/, 'kafka:consumer:delete', {
    destructive: true,
    resource: 'consumer-group',
    resourceParam: 'groupId',
  }),
  rule('POST', /^\/api\/kafka\/consumer-groups\/[^/]+\/reset-offset$/, 'kafka:offset:reset', {
    destructive: true,
    resource: 'consumer-group',
    resourceParam: 'groupId',
  }),
  rule('GET', /^\/api\/kafka\//, 'kafka:read'),

  // ── Airflow ─────────────────────────────────────────────────────────────
  // The preflight and the conf spec are read-only evaluations of a trigger
  // that has not happened yet. They are gated with `airflow:read` — the
  // wizard must be visible to anyone who may inspect the DAG, and neither
  // endpoint mutates anything.
  rule('POST', /^\/api\/airflow\/dags\/[^/]+\/preflight$/, 'airflow:read', {
    resource: 'dag',
    resourceParam: 'dagId',
  }),
  rule('POST', /^\/api\/airflow\/dags\/[^/]+\/(pause|unpause)$/, 'airflow:dag:manage', {
    resource: 'dag',
    resourceParam: 'dagId',
  }),
  rule('POST', /^\/api\/airflow\/dags\/[^/]+\/trigger$/, 'airflow:trigger', {
    resource: 'dag',
    resourceParam: 'dagId',
  }),
  rule('DELETE', /^\/api\/airflow\/dags\/[^/]+\/runs\/[^/]+$/, 'airflow:run:cancel', {
    destructive: true,
    resource: 'dag-run',
    resourceParam: 'runId',
  }),
  rule('GET', /^\/api\/airflow\//, 'airflow:read'),

  // ── Crawler ─────────────────────────────────────────────────────────────
  rule('POST', /^\/api\/crawler\/[^/]+\/(run|run-async|stop)$/, 'crawler:run', {
    resource: 'crawler',
    resourceParam: 'name',
  }),
  rule('PUT', /^\/api\/crawler\/[^/]+\/config$/, 'crawler:config:manage', {
    resource: 'crawler',
    resourceParam: 'name',
  }),
  rule('GET', /^\/api\/crawler\//, READ),

  // ── Dashboard / activity ─────────────────────────────────────────────────
  // The dashboard endpoints are read models over the operation registry, the
  // audit ledger and the provider counters. They expose actor and reference,
  // so they require the same read permission as the dataset metadata they
  // summarise. The rules are ordered from the most specific path so a
  // generic prefix cannot accidentally authorise a future mutation.
  rule('GET', /^\/api\/dashboard\/(summary|dependencies|activity)$/, 'dataset:read'),

  // ── Unified operations ───────────────────────────────────────────────────
  // The operation endpoints are the canonical entry point for every
  // long-running action, so they carry the union of the permissions their
  // domain routes already enforce: creating an operation may start an
  // ingestion, a pipeline run, a DQ evaluation or a crawler run.
  rule('POST', /^\/api\/operations\/[^/]+\/(cancel|retry)$/, 'job:cancel', {
    resource: 'job',
    resourceParam: 'operationId',
  }),
  rule('POST', /^\/api\/operations$/, 'pipeline:run', { resource: 'dataset' }),
  rule('GET', /^\/api\/operations/, 'dataset:read'),

  // ── EDA / profiling ──────────────────────────────────────────────────────
  // Profiling is read-only but it *computes* — it reads the dataset and
  // produces derived statistics. It therefore requires `dataset:profile`,
  // which the `viewer` role does not hold. The sample endpoint returns
  // raw rows, so it additionally requires `dataset:sample`.
  rule('GET', /^\/api\/eda\/profiles\/[^/]+\/sample$/, SAMPLE),
  rule('POST', /^\/api\/eda\/propose-rule$/, 'dq:rule:manage', { resource: 'dataset' }),
  rule('POST', /^\/api\/eda\/(compare|profiles)$/, 'dataset:profile', { resource: 'dataset' }),
  rule('GET', /^\/api\/eda\//, 'dataset:profile'),

  // ── Data quality ────────────────────────────────────────────────────────
  rule('DELETE', /^\/api\/dq\/rules\/[^/]+$/, 'dq:rule:delete', {
    destructive: true,
    resource: 'rule',
    resourceParam: 'ruleId',
  }),
  rule('PUT', /^\/api\/dq\/rules\/[^/]+$/, 'dq:rule:manage', {
    resource: 'rule',
    resourceParam: 'ruleId',
  }),
  rule('POST', /^\/api\/dq\/rules$/, 'dq:rule:manage', { resource: 'rule' }),
  rule('POST', /^\/api\/dq\/rules\/[^/]+\/run$/, 'dataset:dq', { resource: 'dataset' }),
  rule('POST', /^\/api\/dq\/run-suite$/, 'dataset:dq', { resource: 'dataset' }),
  // The preset wizard: the check is read-only, the apply creates a rule.
  rule('POST', /^\/api\/dq\/presets\/[^/]+\/apply$/, 'dq:rule:manage', {
    resource: 'rule',
  }),
  rule('POST', /^\/api\/dq\/presets\/[^/]+\/check$/, 'dataset:dq', { resource: 'dataset' }),
  // Failed-sample rows are data, not metadata — they need the sample
  // permission even though the values are redacted before they leave the API.
  rule('GET', /^\/api\/dq\/runs\/[^/]+\/samples$/, SAMPLE),
  rule('GET', /^\/api\/dq\/(runs|summary)/, 'dataset:dq'),
  rule('GET', /^\/api\/dq\//, READ),
];

/** Routes that stay reachable without a credential. */
const PUBLIC_ROUTES: readonly RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/health\/deep$/,
  /^\/api\/info$/,
  /^\/api\/docs$/,
  /^\/api\/doc$/,
  /^\/api\/api-doc$/,
  /^\/api\/auth\/login$/,
];

export function isPublicRoute(method: string, path: string): boolean {
  if (method === 'OPTIONS') return true;
  return PUBLIC_ROUTES.some((pattern) => pattern.test(path));
}

/**
 * Resolve the policy for a route.
 *
 * `UNKNOWN_ROUTE` is returned for a path that has no rule. The middleware
 * treats it as "deny" when authentication is enabled and as "allow" when it
 * is disabled, so a newly added route can never silently bypass an
 * authenticated deployment.
 */
export function resolvePolicy(method: string, path: string): RoutePolicy | null {
  const normalizedMethod = method.toUpperCase();
  for (const entry of POLICY_RULES) {
    if (entry.method !== normalizedMethod) continue;
    if (entry.pattern.test(path)) {
      return {
        permission: entry.permission,
        destructive: entry.destructive,
        ...(entry.resource ? { resource: entry.resource } : {}),
        ...(entry.resourceParam ? { resourceParam: entry.resourceParam } : {}),
      };
    }
  }
  return null;
}

export function listPolicyRules(): ReadonlyArray<{
  method: string;
  pattern: string;
  permission: SecurityPermission;
  destructive: boolean;
}> {
  return POLICY_RULES.map((entry) => ({
    method: entry.method,
    pattern: entry.pattern.source,
    permission: entry.permission,
    destructive: entry.destructive,
  }));
}
