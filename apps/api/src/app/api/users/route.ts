import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { created, ok } from '@/lib/http';
import { UserController } from '@/modules/security/controllers';
import { CreateUserBodySchema } from '@/modules/security/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await UserController.list();
  return ok(data);
};

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = CreateUserBodySchema.parse(await req.json().catch(() => ({})));
  const data = await UserController.create(body);
  return created(data);
};

export const GET = withSecurity(handleGet);
export const POST = withSecurity(handlePost);
