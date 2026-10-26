import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config';
import { AppError } from '@/errors';
import type { SessionTokenPayload } from '../types';

/**
 * Stateless token service.
 *
 * Tokens are HMAC-SHA256 signed compact tokens (`base64url(header).base64url(payload).base64url(signature)`).
 * A dedicated library is intentionally avoided: the project rule forbids
 * adding dependencies without a proven technical reason, and the required
 * primitive (`crypto.createHmac` + `timingSafeEqual`) is in the standard
 * library.
 */

const HEADER = { alg: 'HS256', typ: 'LKHS' } as const;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

function sign(signingInput: string): string {
  return base64UrlEncode(
    createHmac('sha256', env.API_JWT_SECRET).update(signingInput).digest(),
  );
}

function encodePayload(payload: Record<string, unknown>): string {
  return base64UrlEncode(JSON.stringify(payload));
}

/** Issue a signed token with the given payload and expiry (epoch seconds). */
export function issueToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const signingInput = `${base64UrlEncode(JSON.stringify(HEADER))}.${encodePayload(body)}`;
  return `${signingInput}.${sign(signingInput)}`;
}

function verifySignature(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const signingInput = `${parts[0]}.${parts[1]}`;
  const expected = sign(signingInput);
  const provided = parts[2] ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function decodeVerified(token: string): Record<string, unknown> | null {
  if (!verifySignature(token)) return null;
  const parts = token.split('.');
  const payloadPart = parts[1] ?? '';
  try {
    const parsed = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isExpired(payload: Record<string, unknown>): boolean {
  const exp = payload.exp;
  if (typeof exp !== 'number') return true;
  return Math.floor(Date.now() / 1000) >= exp;
}

export interface IssuedSession {
  token: string;
  expiresAt: number;
}

/** Issue a user session token. */
export function issueSessionToken(input: {
  principalId: string;
  role: SessionTokenPayload['role'];
  scopes: string[];
}): IssuedSession {
  const ttl = env.API_SESSION_TTL_SECONDS;
  const token = issueToken(
    {
      sub: input.principalId,
      role: input.role,
      scopes: input.scopes,
      kind: 'user',
      jti: base64UrlEncode(Buffer.from(`${input.principalId}:${Date.now()}`)),
    },
    ttl,
  );
  return { token, expiresAt: Math.floor(Date.now() / 1000) + ttl };
}

/**
 * Verify a session token.
 *
 * Returns `null` for every failure mode (bad signature, malformed payload,
 * expired) so the caller cannot distinguish them — that keeps the response
 * identical for a forged and for an expired credential.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  const payload = decodeVerified(token);
  if (!payload) return null;
  if (isExpired(payload)) return null;
  const { sub, role, scopes } = payload;
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (role !== 'viewer' && role !== 'analyst' && role !== 'operator' && role !== 'admin') {
    return null;
  }
  if (!Array.isArray(scopes) || scopes.some((s) => typeof s !== 'string')) return null;
  return {
    sub,
    role,
    scopes: scopes as string[],
    iat: typeof payload.iat === 'number' ? payload.iat : 0,
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
    jti: typeof payload.jti === 'string' ? payload.jti : '',
  };
}

/**
 * Issue a single-use confirmation token for a destructive action.
 *
 * MASTER PLAN §05.3: "backend permission và server-side confirm token; UI
 * confirm không đủ cho security". The token is bound to the subject, the
 * action and the exact resource, and expires quickly.
 */
export function issueConfirmToken(input: {
  principalId: string;
  action: string;
  resource: string;
}): { token: string; expiresAt: number } {
  const ttl = env.API_CONFIRM_TOKEN_TTL_SECONDS;
  const token = issueToken(
    {
      sub: input.principalId,
      action: input.action,
      resource: input.resource,
      kind: 'confirm',
      jti: base64UrlEncode(Buffer.from(`${input.principalId}:${input.action}:${Date.now()}`)),
    },
    ttl,
  );
  return { token, expiresAt: Math.floor(Date.now() / 1000) + ttl };
}

/** Validate a confirmation token against the expected subject/action/resource. */
export function verifyConfirmToken(input: {
  token: string;
  principalId: string;
  action: string;
  resource: string;
}): boolean {
  const payload = decodeVerified(input.token);
  if (!payload) return false;
  if (payload.kind !== 'confirm') return false;
  if (isExpired(payload)) return false;
  if (payload.sub !== input.principalId) return false;
  if (payload.action !== input.action) return false;
  if (payload.resource !== input.resource) return false;
  return true;
}

export function assertJwtSecretConfigured(): void {
  if (env.API_JWT_SECRET.length < 32) {
    throw new AppError(
      500,
      'AUTH_SECRET_INVALID',
      'API_JWT_SECRET must be at least 32 characters long.',
    );
  }
}
