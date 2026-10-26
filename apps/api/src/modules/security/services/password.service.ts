import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError } from '@/errors';

/**
 * Password hashing.
 *
 * scrypt from the Node standard library — no extra dependency is added, in
 * line with the project rule against introducing packages without a proven
 * need. The stored format is `scrypt$<salt>$<hash>` (both base64).
 */

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(plaintext: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plaintext, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(plaintext: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1] ?? '', 'base64');
  const expected = Buffer.from(parts[2] ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = scryptSync(plaintext, salt, expected.length, SCRYPT_PARAMS);
  return timingSafeEqual(derived, expected);
}

/**
 * Validate a password policy.
 *
 * The minimum length is deliberately generous because the credential is used
 * against a control plane that can mutate production data.
 */
export function assertPasswordPolicy(plaintext: string): void {
  if (plaintext.length < 12) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', 'Password must be at least 12 characters.');
  }
  if (!/[a-z]/.test(plaintext) || !/[A-Z]/.test(plaintext) || !/\d/.test(plaintext)) {
    throw new AppError(
      400,
      'PASSWORD_TOO_WEAK',
      'Password must contain lower case, upper case and a digit.',
    );
  }
}
