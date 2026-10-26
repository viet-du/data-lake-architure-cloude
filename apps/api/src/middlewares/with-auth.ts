import type { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config';
import { errorResponse } from '@/lib/http';
import { logger } from '@/lib/logger';
import {
  AuditService,
  authorize,
  isPublicRoute,
  resolvePolicy,
  syntheticPrincipal,
  verifyConfirmToken,
  type CredentialResult,
} from '@/modules/security/services';
import type { Principal, RoutePolicy } from '@/modules/security/types';
import type { RouteHandler } from './with-error-handler';

const authLogger = logger.child({ module: 'auth' });

export interface AuthContext {
  principal: Principal;
  policy: RoutePolicy | null;
  requestId: string | null;
}

type Ctx = Record<string, unknown> & {
  requestId?: string;
  credential?: CredentialResult;
};

/**
 * Resolve the concrete resource identifier for a route.
 *
 * The identifier comes from the route parameters, never from the request
 * body, so it cannot be spoofed by a crafted payload.
 *
 * A policy that declares a resource but no `resourceParam` resolves to
 * `null`: the affected routes carry the resource in the request body (for
 * example the target dataset of an ingest), which the middleware cannot
 * read without consuming the stream. Falling back to the last path segment
 * would fabricate an identifier such as `"csv"` for
 * `/api/bronze/ingest/csv` and would then reject a legitimately scoped
 * operator. The body-level dataset scope is enforced where the body is
 * parsed.
 */
async function resolveResource(
  req: NextRequest,
  ctx: unknown,
  policy: RoutePolicy | null,
): Promise<string | null> {
  if (!policy?.resource || !policy.resourceParam) return null;
  const rawParams = (ctx as { params?: unknown } | undefined)?.params;
  const resolved = rawParams instanceof Promise ? await rawParams : rawParams;
  if (!resolved || typeof resolved !== 'object') return null;
  const params = resolved as Record<string, unknown>;
  const value = params[policy.resourceParam];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Authentication + authorization wrapper.
 *
 * Applied to every API route. Responsibilities:
 *
 *  1. consume the credential resolved by `withIdentity`,
 *  2. resolve the route policy,
 *  3. authorize the action (role + scope + destructive confirmation),
 *  4. attach the principal to the request context,
 *  5. write an audit event for every mutation and every denial.
 *
 * A public route skips the authorization decision but not the rest of the
 * chain: it still receives a synthetic principal, so the rate limiter can
 * budget it by client address, and a mutating public route (login) is still
 * audited.
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const startedAt = Date.now();
    const method = req.method.toUpperCase();
    const path = new URL(req.url).pathname;
    const requestId = (ctx as Ctx)?.requestId ?? null;
    const publicRoute = isPublicRoute(method, path);

    const policy = resolvePolicy(method, path);
    const resource = await resolveResource(req, ctx, policy);

    let principal: Principal | null = null;

    if (publicRoute || !env.API_AUTH_ENABLED) {
      principal = syntheticPrincipal();
    } else {
      const credential = (ctx as Ctx)?.credential;
      if (credential?.ok) principal = credential.principal;

      const confirmHeader = req.headers.get('x-confirm-token');
      let confirmTokenPresent = false;
      if (confirmHeader && principal && policy) {
        confirmTokenPresent = verifyConfirmToken({
          token: confirmHeader,
          principalId: principal.principalId,
          action: policy.permission,
          resource: resource ?? '',
        });
      }

      const decision = authorize({
        principal,
        policy,
        resource,
        method,
        path,
        confirmTokenPresent,
      });

      if (!decision.allowed) {
        const status = decision.code === 'MISSING_CREDENTIAL' ? 401 : 403;
        await AuditService.record({
          requestId,
          principal: principal ?? syntheticPrincipal(),
          action: policy?.permission ?? 'unknown',
          method,
          path,
          resource,
          resourceKind: policy?.resource ?? null,
          outcome: 'denied',
          statusCode: status,
          durationMs: Date.now() - startedAt,
          metadata: { reasonCode: decision.code },
        });
        authLogger.warn(
          { path, method, reasonCode: decision.code, requestId },
          'Request denied by authorization policy',
        );
        return errorResponse(
          decision.code === 'MISSING_CREDENTIAL' ? 'UNAUTHORIZED' : 'FORBIDDEN',
          decision.reason,
          status,
          { reasonCode: decision.code, ...(resource ? { resource } : {}) },
        );
      }
    }

    const enriched = { ...((ctx as Ctx) ?? {}), principal, policy } as Ctx;

    const response = await handler(req, enriched);

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      await AuditService.record({
        requestId,
        principal: principal ?? syntheticPrincipal(),
        action: policy?.permission ?? 'unknown',
        method,
        path,
        resource,
        resourceKind: policy?.resource ?? null,
        outcome: response.status >= 400 ? 'failure' : 'success',
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      });
    }
    return response;
  };
}
