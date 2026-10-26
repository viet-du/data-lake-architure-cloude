import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { unwrapParams } from '@/lib/http';
import { UserController } from '@/modules/security/controllers';
import { UpdateUserBodySchema, UserIdParamSchema } from '@/modules/security/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ userId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, UserIdParamSchema);
  const data = await UserController.get(params);
  return ok(data);
};

const handlePut: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, UserIdParamSchema);
  const body = UpdateUserBodySchema.parse(await req.json().catch(() => ({})));
  const data = await UserController.update(params, body);
  return ok(data);
};

export const GET = withSecurity(handleGet);
export const PUT = withSecurity(handlePut);
