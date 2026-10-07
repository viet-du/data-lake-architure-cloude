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
      const message = err instanceof Error ? err.message : 'Internal server error';
      logger.error({ err, url: req.url, method: req.method }, 'Unhandled route error');
      return errorResponse('INTERNAL_ERROR', message, 500);
    }
  };
}