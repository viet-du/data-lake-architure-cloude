import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  scripts: Record<string, string>;
}

function readManifest(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest;
}

describe('development runtime boundaries', () => {
  const apiRoot = resolve(__dirname, '../..');
  const workspaceRoot = resolve(apiRoot, '../..');

  it('keeps BullMQ workers outside Next instrumentation', () => {
    expect(existsSync(resolve(apiRoot, 'src/instrumentation.ts'))).toBe(false);
    expect(existsSync(resolve(apiRoot, 'src/workers/main.ts'))).toBe(true);
  });

  it('starts the API and worker as separate processes', () => {
    const manifest = readManifest(resolve(apiRoot, 'package.json'));

    expect(manifest.scripts.dev).toContain('next dev -p 3001');
    expect(manifest.scripts.dev).toContain('src/workers/main.ts');
  });

  it('starts both workspace applications from the root command', () => {
    const manifest = readManifest(resolve(workspaceRoot, 'package.json'));

    expect(manifest.scripts.dev).toContain('--filter lakehouse-api');
    expect(manifest.scripts.dev).toContain('--filter @lakehouse/web');
  });
});
