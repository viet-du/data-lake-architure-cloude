import { env } from '@/config';
import {
  ROLE_PERMISSIONS,
  type AuthorizationDecision,
  type Principal,
  type RoutePolicy,
  type SecurityPermission,
} from '../types';

/**
 * Authorization decisions.
 *
 * The order of the checks matters:
 *
 *  1. auth disabled → allow (local development only, explicit opt-in)
 *  2. missing credential → 401
 *  3. insufficient role → 403
 *  4. out of scope → 403
 *
 * A destructive route additionally requires a server-side confirmation token,
 * because a UI confirmation alone is not a security control
 * (MASTER PLAN §05.3).
 */

export function permissionsFor(principal: Principal): ReadonlySet<SecurityPermission> {
  return new Set(ROLE_PERMISSIONS[principal.role]);
}

/**
 * Match a scope pattern against a resource identifier.
 *
 * A scope is either an exact identifier (`retail.orders`) or a wildcard
 * pattern (`retail.*`, `*`). The pattern is anchored so `retail` cannot match
 * `retailx`.
 */
export function scopeMatches(scope: string, resource: string): boolean {
  if (scope === '*') return true;
  if (!scope.includes('*')) return scope === resource;
  const escaped = scope.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(resource);
}

/**
 * Decide whether a principal may perform an action on a resource.
 *
 * `resource` is the concrete identifier (e.g. `retail.orders`, `orders.events`)
 * that the scope patterns are matched against.
 */
export function authorize(input: {
  principal: Principal | null;
  policy: RoutePolicy | null;
  resource: string | null;
  method: string;
  path: string;
  confirmTokenPresent: boolean;
}): AuthorizationDecision {
  if (!env.API_AUTH_ENABLED) {
    return { allowed: true, reason: 'Authentication is disabled for this environment.', code: 'AUTH_DISABLED' };
  }

  if (!input.principal) {
    return {
      allowed: false,
      reason: 'Authentication required. Provide a Bearer token or X-Service-Key.',
      code: 'MISSING_CREDENTIAL',
    };
  }

  if (input.principal.expiresAt !== undefined && input.principal.expiresAt <= Date.now()) {
    return {
      allowed: false,
      reason: 'The credential has expired.',
      code: 'EXPIRED_CREDENTIAL',
    };
  }

  if (!input.policy) {
    return {
      allowed: false,
      reason: `No authorization policy is defined for ${input.method} ${input.path}.`,
      code: 'UNKNOWN_ROUTE',
    };
  }

  const granted = permissionsFor(input.principal);
  if (!granted.has(input.policy.permission)) {
    return {
      allowed: false,
      reason: `Role "${input.principal.role}" does not grant "${input.policy.permission}".`,
      code: 'INSUFFICIENT_ROLE',
    };
  }

  if (input.principal.scopes.length > 0 && input.resource) {
    const inScope = input.principal.scopes.some((scope) => scopeMatches(scope, input.resource!));
    if (!inScope) {
      return {
        allowed: false,
        reason: `Resource "${input.resource}" is outside the principal scope.`,
        code: 'OUT_OF_SCOPE',
      };
    }
  }

  if (input.policy.destructive && !input.confirmTokenPresent) {
    return {
      allowed: false,
      reason: 'A server-side confirmation token is required for this destructive operation.',
      code: 'CONFIRMATION_REQUIRED',
    };
  }

  return { allowed: true, reason: 'Allowed.', code: 'ALLOWED' };
}
