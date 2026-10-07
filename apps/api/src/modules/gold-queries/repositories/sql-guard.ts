const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'REPLACE',
  'GRANT',
  'REVOKE',
  'COPY',
  'EXPORT',
  'IMPORT',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'SET',
  'CALL',
  'INSTALL',
  'LOAD',
];

const FORBIDDEN_PATTERNS = [
  /;\s*[A-Za-z]/,
  /--/,
  /\/\*[\s\S]*?\*\//,
];

export interface SqlGuardResult {
  ok: boolean;
  reason?: string;
}

export function validateAdHocSql(sql: string): SqlGuardResult {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'SQL must not be empty' };
  }
  if (!trimmed.toLowerCase().startsWith('select') && !trimmed.toLowerCase().startsWith('with')) {
    return { ok: false, reason: 'Only SELECT or WITH statements are allowed' };
  }
  const upper = trimmed.toUpperCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${keyword}\\b`, 'i');
    if (re.test(upper)) {
      return { ok: false, reason: `Forbidden keyword detected: ${keyword}` };
    }
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: `Forbidden pattern detected: ${pattern.source}` };
    }
  }
  const semicolonCount = (trimmed.match(/;/g) ?? []).length;
  if (semicolonCount > 1) {
    return { ok: false, reason: 'Multiple statements not allowed' };
  }
  return { ok: true };
}

export function wrapWithRowLimit(sql: string, limit: number): string {
  const trimmed = sql.trim().replace(/;$/, '');
  return `${trimmed} LIMIT ${limit}`;
}