import { ZodError } from 'zod';
import type { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/errors';
import { errorResponse } from '@/lib/http';
import { logger } from '@/lib/logger';

export type RouteHandler = (req: NextRequest, ctx: unknown) => Promise<NextResponse> | NextResponse;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.status, err.details);
      }
      if (err instanceof ZodError) {
        return errorResponse('VALIDATION_ERROR', 'Request validation failed', 400, err.issues);
      }
      logger.error({ err, url: req.url, method: req.method }, 'Unhandled route error');
      // MASTER PLAN §05.3 / working_rule §14.1: an unexpected failure must not
      // expose internal business logic to the client. The full error stays in
      // the server log and is correlated through the request id.
      return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
    }
  };
}