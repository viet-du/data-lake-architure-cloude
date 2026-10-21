import { NextResponse, type NextRequest } from 'next/server';
import { withCors } from '@/middlewares/with-cors';

export function middleware(req: NextRequest) {
  return withCors(() => NextResponse.next())(req);
}

export const config = { matcher: '/api/:path*' };
