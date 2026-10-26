import type { RouteHandler } from './with-error-handler';
import { withAuth } from './with-auth';
import { withErrorHandler } from './with-error-handler';
import { withIdentity } from './with-identity';
import { withRateLimit } from './with-rate-limit';
import { withRequestId } from './with-request-id';

/**
 * The standard route wrapper chain.
 *
 * The order is deliberate:
 *
 *  1. `withRequestId`   — assigns the correlation id first, so every later
 *     layer (including a denial audit event) can reference it.
 *  2. `withErrorHandler` — sanitises every failure raised by the layers
 *     below it, so an authorization or rate-limit failure never leaks an
 *     internal stack trace to the client.
 *  3. `withIdentity`     — resolves the credential and attaches it to the
 *     context. It never rejects; it only makes the identity available.
 *  4. `withRateLimit`    — per-identity request budget. It has to run before
 *     the authorization decision so a request rejected with 401 is still
 *     counted — otherwise the login endpoint could be brute forced without
 *     ever touching a budget.
 *  5. `withAuth`         — resolves the principal, enforces the route policy
 *     and writes the audit event for every mutation and every denial.
 *  6. the route handler.
 *
 * MASTER PLAN §10 / §13.1: "Introduce actual AuthN/AuthZ/RBAC
 * service-to-service permissions for all mutation routes; rate limiting,
 * quota, cancellation ownership, audit."
 */
export function withSecurity(handler: RouteHandler): RouteHandler {
  return withRequestId(
    withErrorHandler(withIdentity(withRateLimit(withAuth(handler)))),
  );
}
