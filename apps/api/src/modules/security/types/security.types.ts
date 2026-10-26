import type {
  AuditOutcome,
  PrincipalKind,
  SecurityPermission,
  SecurityRole,
} from './security.enum';

/**
 * The authenticated caller.
 *
 * `kind` distinguishes a human session from a machine credential, because
 * MASTER PLAN §13.1 requires service credentials to stay separate from the
 * user identity.
 */
export interface Principal {
  /** Stable identifier used for audit trails. */
  principalId: string;
  kind: PrincipalKind;
  role: SecurityRole;
  /**
   * Optional scope patterns.
   *
   * When a principal declares at least one scope, resource-scoped
   * permissions are additionally constrained by it. An empty scope list means
   * "role only" (no scope narrowing).
   */
  scopes: string[];
  /** True when the principal was synthesised because auth is disabled. */
  synthetic: boolean;
  /** Token/service-key identifier, never the secret itself. */
  credentialId?: string;
  /** Expiry of the underlying credential (epoch ms), when it has one. */
  expiresAt?: number;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: string;
  /** Machine readable reason code used in the API error `details`. */
  code:
    | 'ALLOWED'
    | 'AUTH_DISABLED'
    | 'MISSING_CREDENTIAL'
    | 'INVALID_CREDENTIAL'
    | 'EXPIRED_CREDENTIAL'
    | 'INSUFFICIENT_ROLE'
    | 'OUT_OF_SCOPE'
    | 'CONFIRMATION_REQUIRED'
    | 'UNKNOWN_ROUTE';
}

/** Resource kinds that can be scope-constrained. */
export type ResourceKind =
  | 'dataset'
  | 'topic'
  | 'consumer-group'
  | 'dag'
  | 'dag-run'
  | 'table'
  | 'database'
  | 'rule'
  | 'partition'
  | 'job'
  | 'crawler'
  | 'user';

export interface RoutePolicy {
  /** Permission required to call the route. */
  permission: SecurityPermission;
  /** True when the route changes or destroys data/configuration. */
  destructive: boolean;
  /** Resource the route acts on, for scope checks and confirm tokens. */
  resource?: ResourceKind;
  /** Route parameter that carries the resource identifier. */
  resourceParam?: string;
}

export interface AuditEventInput {
  requestId: string | null;
  principal: Principal;
  action: string;
  method: string;
  path: string;
  resource: string | null;
  resourceKind: ResourceKind | null;
  outcome: AuditOutcome;
  statusCode: number;
  durationMs: number;
  /** Free-form, PII-free context (never request bodies). */
  metadata?: Record<string, unknown>;
}

/**
 * The persisted form of an audit event.
 *
 * The ledger stores the *resolved* identity (`principalId`, `principalKind`,
 * `role`) rather than the in-memory `Principal` object, so a read of the
 * ledger never depends on the session that produced it.
 */
export interface AuditEvent {
  eventId: string;
  requestId: string | null;
  principalId: string;
  principalKind: PrincipalKind;
  role: string;
  synthetic: boolean;
  action: string;
  method: string;
  path: string;
  resource: string | null;
  resourceKind: string | null;
  outcome: AuditOutcome;
  statusCode: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ConfirmTokenPayload {
  /** Subject (principal id) the token is bound to. */
  sub: string;
  /** Permission the confirmation applies to. */
  action: string;
  /** Exact resource identifier the confirmation applies to. */
  resource: string;
  /** Issued at / expiry (epoch ms). */
  iat: number;
  exp: number;
  /** Unique token id. */
  jti: string;
}

export interface SessionTokenPayload {
  sub: string;
  role: SecurityRole;
  scopes: string[];
  iat: number;
  exp: number;
  jti: string;
}
