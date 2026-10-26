import { AppError } from '@/errors';

/**
 * PII redaction for failed-sample rows.
 *
 * MASTER PLAN §06.5 and §13.3: "Return only representative failed samples
 * with configurable cap (10–100), redaction for emails/phone/PII".
 *
 * The rule is deliberately conservative and *deterministic*:
 *
 *  * a **column-name** match (email, phone, ssn, password, token, …) always
 *    redacts the whole value, whatever the value looks like;
 *  * a **value-shape** match (an email address, a phone number, a card-like
 *    digit run) redacts the value even when the column name is innocuous —
 *    a mis-named column must not leak a customer address.
 *
 * The redacted marker is a constant, so a consumer can tell "there was a
 * value" from "there was no value" without learning the value.
 */

export const REDACTED = '[REDACTED]';

/** Column-name fragments that always force a redaction. */
const SENSITIVE_COLUMN_PATTERNS: readonly RegExp[] = [
  /(^|[_\s-])email([_\s-]|$)/i,
  /(^|[_\s-])e_mail([_\s-]|$)/i,
  /(^|[_\s-])mail([_\s-]|$)/i,
  /(^|[_\s-])phone([_\s-]|$)/i,
  /(^|[_\s-])mobile([_\s-]|$)/i,
  /(^|[_\s-])telephone([_\s-]|$)/i,
  /(^|[_\s-])ssn([_\s-]|$)/i,
  /(^|[_\s-])social_?security([_\s-]|$)/i,
  /(^|[_\s-])pass(word|wd|phrase)?([_\s-]|$)/i,
  /(^|[_\s-])secret([_\s-]|$)/i,
  /(^|[_\s-])token([_\s-]|$)/i,
  /(^|[_\s-])api_?key([_\s-]|$)/i,
  /(^|[_\s-])credit_?card([_\s-]|$)/i,
  /(^|[_\s-])card_?number([_\s-]|$)/i,
  /(^|[_\s-])iban([_\s-]|$)/i,
  /(^|[_\s-])account_?number([_\s-]|$)/i,
  /(^|[_\s-])address([_\s-]|$)/i,
  /(^|[_\s-])street([_\s-]|$)/i,
  /(^|[_\s-])postcode([_\s-]|$)/i,
  /(^|[_\s-])zip_?code([_\s-]|$)/i,
  /(^|[_\s-])first_?name([_\s-]|$)/i,
  /(^|[_\s-])last_?name([_\s-]|$)/i,
  /(^|[_\s-])full_?name([_\s-]|$)/i,
  /(^|[_\s-])customer_?name([_\s-]|$)/i,
  /(^|[_\s-])dob([_\s-]|$)/i,
  /(^|[_\s-])birth_?date([_\s-]|$)/i,
  /(^|[_\s-])national_?id([_\s-]|$)/i,
  /(^|[_\s-])tax_?id([_\s-]|$)/i,
  /(^|[_\s-])ip(_?address)?([_\s-]|$)/i,
];

/** Value shapes that are PII even under an innocuous column name. */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, // email address
  /^\+?\d[\d\s().-]{7,}$/, // phone-like digit run
  /^\d{13,19}$/, // card-like digit run
  /^\d{3}-\d{2}-\d{4}$/, // SSN-like
  /^\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}$/, // card-like, spaced
];

function columnIsSensitive(name: string): boolean {
  return SENSITIVE_COLUMN_PATTERNS.some((pattern) => pattern.test(name));
}

function valueIsSensitive(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Redact one row.
 *
 * The row shape is preserved (the same keys, the same order) so the UI can
 * still show *which* columns failed — only the sensitive values are
 * replaced.
 */
export function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      output[key] = value;
      continue;
    }
    if (columnIsSensitive(key)) {
      output[key] = REDACTED;
      continue;
    }
    if (typeof value === 'string' && valueIsSensitive(value)) {
      output[key] = REDACTED;
      continue;
    }
    output[key] = value;
  }
  return output;
}

/**
 * Redact a list of failed-sample rows.
 *
 * The cap is enforced here as well: the executor bounds the query with
 * `LIMIT`, but a stored run may have been produced by an older version, so
 * the response never carries more rows than the caller asked for.
 */
export function redactSamples(
  rows: ReadonlyArray<Record<string, unknown>>,
  limit = 10,
): Array<Record<string, unknown>> {
  const capped = Math.max(1, Math.min(limit, 100));
  return rows.slice(0, capped).map((row) => redactRow(row));
}

/**
 * The default cap for failed samples.
 *
 * MASTER PLAN §12.5: "DQ sample default 10 failures, max 100".
 */
export const DEFAULT_SAMPLE_CAP = 10;

/**
 * Guard the sample cap supplied by a client.
 */
export function assertSampleCap(value: number): number {
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    throw new AppError(
      400,
      'INVALID_SAMPLE_CAP',
      `The failed-sample cap must be between 1 and 100 (received ${value}).`,
    );
  }
  return Math.floor(value);
}
