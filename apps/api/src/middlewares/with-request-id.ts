import { randomUUID } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { NextResponse as NextResponseImpl } from 'next/server';
import { REQUEST_ID_HEADER } from '@/config';

export function withRequestId(
  handler: (
    req: NextRequest,
    ctx: Record<string, unknown> & { requestId: string },
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, ctx: unknown): Promise<NextResponse> => {
    const incoming = req.headers.get(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
    const baseCtx = (ctx ?? {}) as Record<string, unknown>;
    const enriched = { ...baseCtx, requestId };
    const res = await handler(req, enriched);
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  };
}

export { NextResponseImpl };