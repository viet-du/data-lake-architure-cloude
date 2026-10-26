import type { NextRequest, NextResponse } from 'next/server';
import { resolvePrincipal, type CredentialResult } from '@/modules/security/services';
import type { RouteHandler } from './with-error-handler';

type Ctx = Record<string, unknown> & { credential?: CredentialResult };

/**
 * Identity resolution.
 *
 * The credential is resolved *before* the rate limiter so the request budget
 * can be keyed by the authenticated identity. Resolving it inside the
 * authorization layer instead would mean that a request rejected with 401 is
 * never counted, which leaves the login endpoint open to brute force
 * (MASTER PLAN §13.1 — rate limiting must cover unauthenticated traffic too).
 *
 * This layer never rejects a request. It only attaches the credential
 * resolution result to the context; the authorization decision belongs to
 * `withAuth`.
 */
export function withIdentity(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const credential = resolvePrincipal({
      authorization: req.headers.get('authorization'),
      serviceKey: req.headers.get('x-service-key'),
      userKey: req.headers.get('x-user-key'),
    });
    const enriched = { ...((ctx as Ctx) ?? {}), credential } as Ctx;
    return handler(req, enriched);
  };
}
