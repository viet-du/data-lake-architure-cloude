import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AuthController } from '@/modules/security/controllers';
import { ConfirmBodySchema } from '@/modules/security/schemas';
import type { Principal } from '@/modules/security/types';

export const runtime = 'nodejs';

type Ctx = { principal?: Principal };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const body = ConfirmBodySchema.parse(await req.json().catch(() => ({})));
  const principal = (ctx as Ctx).principal;
  if (!principal) {
    return ok({ error: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
  }
  const data = await AuthController.confirm(principal, body);
  return ok(data);
};

export const POST = withSecurity(handlePost);
