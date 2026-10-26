import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AuditController } from '@/modules/security/controllers';
import { AuditListQuerySchema } from '@/modules/security/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = AuditListQuerySchema.parse({
    principalId: url.searchParams.get('principalId') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    outcome: url.searchParams.get('outcome') ?? undefined,
    resource: url.searchParams.get('resource') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await AuditController.list(query);
  return ok(data);
};

export const GET = withSecurity(handleGet);
