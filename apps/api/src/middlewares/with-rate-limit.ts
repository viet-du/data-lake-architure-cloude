import type { NextRequest, NextResponse } from 'next/server';
import { NextResponse as NextResponseImpl } from 'next/server';
import { getRedis } from '@/lib/infra/redis';
import { errorResponse } from '@/lib/http';
import { env } from '@/config';

const WINDOW_SECONDS = 60;

export function withRateLimit(handler: (req: NextRequest) => Promise<NextResponse> | NextResponse) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `ratelimit:${ip}`;

    try {
      const redis = getRedis();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }
      if (count > env.API_RATE_LIMIT_PER_MIN) {
        return errorResponse(
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Limit: ${env.API_RATE_LIMIT_PER_MIN}/min`,
          429,
        );
      }
      const res = await handler(req);
      res.headers.set('X-RateLimit-Limit', String(env.API_RATE_LIMIT_PER_MIN));
      res.headers.set('X-RateLimit-Remaining', String(Math.max(0, env.API_RATE_LIMIT_PER_MIN - count)));
      return res;
    } catch {
      return handler(req);
    }
  };
}

export { NextResponseImpl };