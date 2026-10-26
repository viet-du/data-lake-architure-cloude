import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  envFilePath,
  expandEnvValues,
  isContainerised,
  isPlaceholderValue,
  loadEnvFile,
  parseEnvFile,
  resolveEnvPrecedence,
} from '@/config/load-env';

const PRECEDENCE_KEY = 'LAKEHOUSE_ENV_PRECEDENCE';
const ENV_KEY = 'ENV';
const NODE_ENV_KEY = 'NODE_ENV';

/**
 * Restore an environment variable.
 *
 * Assigning `undefined` stores the *string* `"undefined"`, which would then
 * fail the Zod environment schema and break every test file that runs
 * afterwards in the same worker process.
 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe('P0-ENV-01 — canonical environment loader ownership', () => {
  it('prefers the package-local configuration file over a repository-root template', () => {
    expect(envFilePath()).toContain('apps/api/.env.local');
  });

  it('resolves the ownership mode from the explicit operator switch', () => {
    const original = process.env[PRECEDENCE_KEY];
    try {
      process.env[PRECEDENCE_KEY] = 'ambient';
      expect(resolveEnvPrecedence()).toBe('ambient');
      process.env[PRECEDENCE_KEY] = 'file';
      expect(resolveEnvPrecedence()).toBe('file');
    } finally {
      restoreEnv(PRECEDENCE_KEY, original);
    }
  });

  it('treats a deployed environment as ambient-owned', () => {
    const originalPrecedence = process.env[PRECEDENCE_KEY];
    const originalEnv = process.env[ENV_KEY];
    try {
      delete process.env[PRECEDENCE_KEY];
      process.env[ENV_KEY] = 'prod';
      expect(resolveEnvPrecedence()).toBe('ambient');
      process.env[ENV_KEY] = 'staging';
      expect(resolveEnvPrecedence()).toBe('ambient');
    } finally {
      restoreEnv(PRECEDENCE_KEY, originalPrecedence);
      restoreEnv(ENV_KEY, originalEnv);
    }
  });

  it('never uses NODE_ENV to decide ownership, because Next.js builds with production', () => {
    const originalPrecedence = process.env[PRECEDENCE_KEY];
    const originalEnv = process.env[ENV_KEY];
    const originalNodeEnv = process.env[NODE_ENV_KEY];
    try {
      delete process.env[PRECEDENCE_KEY];
      process.env[ENV_KEY] = 'local';
      // `NODE_ENV` is declared readonly by `@types/node`, but the loader
      // only ever *reads* it, so the assignment is restored afterwards.
      (process.env as Record<string, string | undefined>)[NODE_ENV_KEY] = 'production';
      expect(resolveEnvPrecedence()).toBe('file');
    } finally {
      restoreEnv(PRECEDENCE_KEY, originalPrecedence);
      restoreEnv(ENV_KEY, originalEnv);
      restoreEnv(NODE_ENV_KEY, originalNodeEnv);
    }
  });

  it('detects a container without importing node:fs into the Edge bundle', () => {
    expect(typeof isContainerised()).toBe('boolean');
  });
});

describe('P0-ENV-02 — stale ambient values must not shadow the local configuration', () => {
  it('lets the file win over a stale ambient export in file mode', () => {
    const key = 'MINIO_ENDPOINT';
    const original = process.env[key];
    try {
      process.env[key] = '127.0.0.1:19000';
      const applied = loadEnvFile(envFilePath(), 'file');
      expect(applied).toContain(key);
      expect(process.env[key]).toBe('127.0.0.1:9000');
    } finally {
      restoreEnv(key, original);
    }
  });

  it('lets the ambient environment win in ambient mode', () => {
    const key = 'MINIO_ENDPOINT';
    const original = process.env[key];
    try {
      process.env[key] = 'minio:9000';
      loadEnvFile(envFilePath(), 'ambient');
      expect(process.env[key]).toBe('minio:9000');
    } finally {
      restoreEnv(key, original);
    }
  });
});

describe('P0-ENV-03 — file parsing is deterministic and never evaluates code', () => {
  it('parses plain, quoted, exported and commented assignments', () => {
    const parsed = parseEnvFile(
      [
        '# a comment',
        '',
        'PLAIN=value',
        'export EXPORTED=exported-value',
        'QUOTED="quoted value"',
        "SINGLE='single value'",
        'WITH_COMMENT=value # trailing comment',
      ].join('\n'),
    );

    expect(parsed.PLAIN).toBe('value');
    expect(parsed.EXPORTED).toBe('exported-value');
    expect(parsed.QUOTED).toBe('quoted value');
    expect(parsed.SINGLE).toBe('single value');
    expect(parsed.WITH_COMMENT).toBe('value');
  });

  it('matches the dotenv v16 grammar that @next/env applies', () => {
    // Every expectation below was measured against the `@next/env` package
    // that Next.js 15.5.28 bundles — not assumed from documentation.
    const parsed = parseEnvFile(
      [
        'NOT_A_KEY = 1',
        '1INVALID=value',
        'HAS-DASH=dashvalue',
        'DOT.KEY=dotvalue',
        'HASH_NO_SPACE=value#nospace',
        'COLON_SEP: colon value',
        'URL=a=b=c',
        'EMPTY=',
        'NO_EQUALS',
      ].join('\n'),
    );

    // A key may contain letters, digits, `_`, `.` and `-`.
    expect(parsed['NOT_A_KEY']).toBe('1');
    expect(parsed['1INVALID']).toBe('value');
    expect(parsed['HAS-DASH']).toBe('dashvalue');
    expect(parsed['DOT.KEY']).toBe('dotvalue');
    // An unquoted value ends at the first `#`, with or without a space.
    expect(parsed.HASH_NO_SPACE).toBe('value');
    // `:` is a valid separator.
    expect(parsed.COLON_SEP).toBe('colon value');
    // Only the first `=` separates the key from the value.
    expect(parsed.URL).toBe('a=b=c');
    expect(parsed.EMPTY).toBe('');
    // A line without a separator is not an assignment.
    expect(parsed.NO_EQUALS).toBeUndefined();
  });

  it('keeps an indented assignment that a naive line splitter would drop', () => {
    const parsed = parseEnvFile('  INDENTED=indented-value  ');

    expect(parsed.INDENTED).toBe('indented-value');
  });

  it('resolves variable references and keeps an escaped dollar literal', () => {
    const parsed = parseEnvFile(
      ['BASE=base-value', 'REF=$BASE', 'BRACED=${BASE}', 'ESCAPED=\\$BASE'].join('\n'),
    );
    const resolved = expandEnvValues(parsed, 'file');

    expect(resolved.REF).toBe('base-value');
    expect(resolved.BRACED).toBe('base-value');
    expect(resolved.ESCAPED).toBe('$BASE');
  });

  it('drops template placeholder values instead of applying them', async () => {
    expect(isPlaceholderValue('.............enter_here=.............')).toBe(true);
    expect(isPlaceholderValue('real-value')).toBe(false);

    // The parser is a faithful port of dotenv v16, so it reports what the
    // file literally contains.
    expect(parseEnvFile('ENV=.............enter_here=.............')).toEqual({
      ENV: '.............enter_here=.............',
    });

    // The *policy* lives at apply time: a placeholder is never written to
    // `process.env`. The repository ships a root `.env.local` template whose
    // values are placeholders, and loading one of those would replace a
    // valid ambient value with garbage.
    const dir = mkdtempSync(join(tmpdir(), 'lakehouse-env-'));
    const file = join(dir, '.env.local');
    const key = 'LAKEHOUSE_PLACEHOLDER_PROBE';
    writeFileSync(file, `${key}=.............enter_here=.............\n`);
    try {
      delete process.env[key];
      const applied = loadEnvFile(file, 'file');
      expect(applied).not.toContain(key);
      expect(process.env[key]).toBeUndefined();
    } finally {
      delete process.env[key];
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores an expression-looking value instead of evaluating it', () => {
    const parsed = parseEnvFile('DANGEROUS=$(rm -rf /)');
    expect(parsed.DANGEROUS).toBe('$(rm -rf /)');
  });
});
