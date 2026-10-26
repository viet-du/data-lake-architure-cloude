import type { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/infra/redis';
import { errorResponse } from '@/lib/http';
import { env } from '@/config';
import { logger } from '@/lib/logger';
import type { CredentialResult } from '@/modules/security/services';
import type { RouteHandler } from './with-error-handler';

const WINDOW_SECONDS = 60;
const rateLogger = logger.child({ module: 'rate-limit' });

type Ctx = Record<string, unknown> & {
  credential?: CredentialResult;
  principal?: { principalId: string; synthetic?: boolean };
};

/**
 * Rate limit.
 *
 * The counter is keyed by the authenticated identity when a valid credential
 * was resolved, and by the client address otherwise. Two properties matter:
 *
 *  * the limiter runs *before* the authorization decision, so a rejected
 *    request is still counted — otherwise the login endpoint could be brute
 *    forced without ever touching a budget;
 *  * a synthetic (anonymous) principal is never used as the bucket key.
 *    Otherwise every unauthenticated caller would share one counter and a
 *    single client could exhaust the budget of the whole control plane.
 *
 * The failure mode is explicit — `API_RATE_LIMIT_FAIL_OPEN` decides whether
 * an unavailable Redis lets the request through. The default is fail-open so
 * a dependency flap cannot take the dashboard down.
 */
export function withRateLimit(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const context = (ctx as Ctx | undefined) ?? {};
    const credentialPrincipal = context.credential?.ok ? context.credential.principal : null;
    const principal = credentialPrincipal ?? context.principal;
    const principalId = principal && !principal.synthetic ? principal.principalId : null;
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientKey = principalId ?? forwarded ?? 'unknown';
    const key = `ratelimit:${clientKey}`;

    let count: number;
    try {
      const redis = getRedis();
      count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }
    } catch (error) {
      rateLogger.error({ err: error, clientKey }, 'Rate limit backend unavailable');
      if (env.API_RATE_LIMIT_FAIL_OPEN) {
        return handler(req, ctx);
      }
      return errorResponse(
        'RATE_LIMIT_UNAVAILABLE',
        'Rate limiting is temporarily unavailable. Retry shortly.',
        503,
      );
    }

    if (count > env.API_RATE_LIMIT_PER_MIN) {
      rateLogger.warn({ clientKey, count, path: req.url }, 'Rate limit exceeded');
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        `Too many requests. Limit: ${env.API_RATE_LIMIT_PER_MIN}/min`,
        429,
      );
    }

    const res = await handler(req, ctx);
    res.headers.set('X-RateLimit-Limit', String(env.API_RATE_LIMIT_PER_MIN));
    res.headers.set('X-RateLimit-Remaining', String(Math.max(0, env.API_RATE_LIMIT_PER_MIN - count)));
    return res;
  };
}
