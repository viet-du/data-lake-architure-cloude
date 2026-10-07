import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env, CORS_DEFAULT_HEADERS } from '@/config';

function applyCorsHeaders(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin');
  const allowed = env.API_CORS_ORIGINS.split(',').map((o) => o.trim());

  if (origin && allowed.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', CORS_DEFAULT_HEADERS.join(', '));
    res.headers.set('Access-Control-Max-Age', '86400');
  }

  return res;
}

export type CorsHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

export function withCors(handler: CorsHandler): CorsHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (req.method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 204 });
      return applyCorsHeaders(req, res);
    }
    const res = await handler(req);
    return applyCorsHeaders(req, res);
  };
}