import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AuthController } from '@/modules/security/controllers';
import { LoginBodySchema } from '@/modules/security/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = LoginBodySchema.parse(await req.json().catch(() => ({})));
  const data = await AuthController.login(body);
  return ok(data);
};

export const POST = withSecurity(handlePost);
