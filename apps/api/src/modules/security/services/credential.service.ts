import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '@/config';
import type { Principal, SecurityRole } from '../types';
import { verifySessionToken } from './token.service';

/**
 * Credential resolution.
 *
 * Three credential families are supported, and the human identity stays
 * separate from the machine identity (MASTER PLAN §13.1: "service
 * credentials separate from user identity"):
 *
 *  * **Session token** — `Authorization: Bearer <jwt>` issued to a human.
 *  * **User key** — `X-User-Key: <key>` for a human identity configured
 *    through `API_USER_CREDENTIALS` (CI, automation acting as a person).
 *  * **Service key** — `X-Service-Key: <key>` for machine-to-machine calls.
 *
 * Secrets are never stored in plaintext: the environment holds a
 * `keyId:sha256(secret)` pair per credential and the lookup is a hash
 * comparison.
 */

export interface ServiceCredential {
  keyId: string;
  secretHash: string;
  principalId: string;
  role: SecurityRole;
  scopes: string[];
  expiresAt?: number;
}

export type CredentialResult =
  | { ok: true; principal: Principal }
  | { ok: false; code: 'MISSING_CREDENTIAL' | 'INVALID_CREDENTIAL' | 'EXPIRED_CREDENTIAL'; reason: string };

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isSecurityRole(value: unknown): value is SecurityRole {
  return value === 'viewer' || value === 'analyst' || value === 'operator' || value === 'admin';
}

function parseCredentialEntries(raw: string | undefined): ServiceCredential[] {
  if (!raw || raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: ServiceCredential[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const keyId = record.keyId;
    const secretHash = record.secretHash;
    const principalId = record.principalId;
    const role = record.role;
    if (typeof keyId !== 'string' || keyId.length === 0) continue;
    if (typeof secretHash !== 'string' || secretHash.length === 0) continue;
    if (typeof principalId !== 'string' || principalId.length === 0) continue;
    if (!isSecurityRole(role)) continue;
    const scopes = Array.isArray(record.scopes)
      ? record.scopes.filter((s): s is string => typeof s === 'string')
      : [];
    result.push({
      keyId,
      secretHash,
      principalId,
      role,
      scopes,
      ...(typeof record.expiresAt === 'number' ? { expiresAt: record.expiresAt } : {}),
    });
  }
  return result;
}

/** Parse the `API_SERVICE_KEYS` env value into credential records. */
export function parseServiceCredentials(raw: string | undefined): ServiceCredential[] {
  return parseCredentialEntries(raw);
}

/** Parse the `API_USER_CREDENTIALS` env value into credential records. */
export function parseUserCredentials(raw: string | undefined): ServiceCredential[] {
  return parseCredentialEntries(raw);
}

export function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match?.[1]?.trim() ?? null;
}

interface StaticCredentialInput {
  headerValue: string | null;
  credentials: ServiceCredential[];
  kind: 'user' | 'service';
}

/**
 * Resolve a static (`keyId:secret`) credential.
 *
 * The failure reasons are intentionally coarse so a caller cannot probe
 * whether a key id exists.
 */
function resolveStaticCredential(input: StaticCredentialInput): CredentialResult {
  const raw = input.headerValue?.trim();
  if (!raw) {
    return {
      ok: false,
      code: 'MISSING_CREDENTIAL',
      reason: 'Authentication required.',
    };
  }
  const separator = raw.indexOf(':');
  if (separator <= 0) {
    return { ok: false, code: 'INVALID_CREDENTIAL', reason: 'The credential is malformed.' };
  }
  const keyId = raw.slice(0, separator);
  const secret = raw.slice(separator + 1);
  const match = input.credentials.find((credential) => credential.keyId === keyId);
  if (!match) {
    return { ok: false, code: 'INVALID_CREDENTIAL', reason: 'The credential is not recognised.' };
  }
  if (!constantTimeEquals(hashSecret(secret), match.secretHash)) {
    return { ok: false, code: 'INVALID_CREDENTIAL', reason: 'The credential is not recognised.' };
  }
  if (match.expiresAt !== undefined && match.expiresAt <= Date.now()) {
    return { ok: false, code: 'EXPIRED_CREDENTIAL', reason: 'The credential has expired.' };
  }
  return {
    ok: true,
    principal: {
      principalId: match.principalId,
      kind: input.kind,
      role: match.role,
      scopes: match.scopes,
      synthetic: false,
      credentialId: match.keyId,
      ...(match.expiresAt !== undefined ? { expiresAt: match.expiresAt } : {}),
    },
  };
}

/**
 * Resolve the caller from the request headers.
 *
 * The function never throws: the caller decides how to react to a failure,
 * and the failure reasons are intentionally coarse so a caller cannot probe
 * whether a key id exists.
 */
export function resolvePrincipal(headers: {
  authorization: string | null;
  serviceKey: string | null;
  userKey?: string | null;
}): CredentialResult {
  const bearer = extractBearerToken(headers.authorization);
  if (bearer) {
    const payload = verifySessionToken(bearer);
    if (!payload) {
      return {
        ok: false,
        code: 'INVALID_CREDENTIAL',
        reason: 'The bearer token is invalid or expired.',
      };
    }
    return {
      ok: true,
      principal: {
        principalId: payload.sub,
        kind: 'user',
        role: payload.role,
        scopes: payload.scopes,
        synthetic: false,
        ...(payload.jti ? { credentialId: payload.jti } : {}),
        ...(payload.exp ? { expiresAt: payload.exp * 1000 } : {}),
      },
    };
  }

  if (headers.userKey) {
    return resolveStaticCredential({
      headerValue: headers.userKey,
      credentials: parseUserCredentials(env.API_USER_CREDENTIALS),
      kind: 'user',
    });
  }

  if (headers.serviceKey) {
    return resolveStaticCredential({
      headerValue: headers.serviceKey,
      credentials: parseServiceCredentials(env.API_SERVICE_KEYS),
      kind: 'service',
    });
  }

  return {
    ok: false,
    code: 'MISSING_CREDENTIAL',
    reason: 'Authentication required. Provide a Bearer token or X-Service-Key.',
  };
}

/**
 * The principal used when authentication is disabled.
 *
 * It is flagged as `synthetic` so the audit trail can distinguish it from a
 * real authenticated caller.
 */
export function syntheticPrincipal(): Principal {
  return {
    principalId: 'anonymous',
    kind: 'anonymous',
    role: 'admin',
    scopes: [],
    synthetic: true,
  };
}
