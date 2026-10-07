import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function accepted<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 202 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  const body: { error: string; message: string; details?: unknown } = { error: code, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export async function unwrapParams<T>(
  ctx: unknown,
  schema: { parse: (input: unknown) => T },
): Promise<T> {
  const params = (ctx as { params: unknown }).params;
  if (params === undefined) {
    throw new Error('unwrapParams: ctx.params is undefined');
  }
  const resolved = params instanceof Promise ? await params : params;
  return schema.parse(resolved);
}