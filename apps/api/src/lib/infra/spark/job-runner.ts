import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '@/config';
import { AppError } from '@/errors';
import { logger } from '@/lib/logger';

/**
 * Typed bridge to the Python/Spark job runner.
 *
 * MASTER PLAN §10.2 requires a "Typed worker CLI/JSON job protocol
 * (whitelisted operations), not shell injection". This adapter is the only
 * place that spawns a Python process; the operation set is a fixed allowlist
 * and every parameter is validated with Zod before the child process starts.
 *
 * The child process is spawned with an argv array (never `shell: true`), so
 * no user-controlled string can be interpreted by a shell.
 */

/** Whitelisted operations — mirrors `lakehouse.jobs.protocol.ALLOWED_OPERATIONS`. */
export const JOB_OPERATIONS = [
  'bronze.ingest_csv',
  'bronze.ingest_json',
  'bronze.ingest_stream',
  'silver.transform',
  'gold.aggregate',
] as const;
export type JobOperation = (typeof JOB_OPERATIONS)[number];

const JobDatasetSchema = z.object({
  provider: z.string(),
  layer: z.string(),
  database: z.string(),
  table: z.string(),
  path: z.string(),
  deltaVersion: z.number().int().nonnegative().nullable(),
  rowCount: z.number().int().nonnegative().nullable(),
});

export const JobResponseSchema = z.object({
  status: z.enum(['succeeded', 'failed']),
  operation: z.string(),
  jobId: z.string(),
  rows: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  dataset: JobDatasetSchema.nullable(),
  metrics: z.record(z.unknown()),
  error: z.string().nullable(),
});

export type JobResponse = z.infer<typeof JobResponseSchema>;

export interface JobRequest {
  operation: JobOperation;
  jobId: string;
  params: Record<string, unknown>;
}

/** Per-operation parameter schemas — the allowlist boundary. */
const OperationParamsSchema = {
  'bronze.ingest_csv': z.object({
    source: z.string().min(1).max(4096),
    database: z.string().regex(/^[a-z0-9_]+$/),
    table: z.string().regex(/^[a-z0-9_]+$/),
    options: z.record(z.unknown()).optional(),
  }),
  'bronze.ingest_json': z.object({
    source: z.string().min(1).max(4096),
    database: z.string().regex(/^[a-z0-9_]+$/),
    table: z.string().regex(/^[a-z0-9_]+$/),
  }),
  'bronze.ingest_stream': z.object({
    topic: z.string().min(1).max(255),
    database: z.string().regex(/^[a-z0-9_]+$/),
    table: z.string().regex(/^[a-z0-9_]+$/),
    consumerGroup: z.string().min(1).max(255).optional(),
    maxMessages: z.number().int().min(1).max(1_000_000).optional(),
    timeoutMs: z.number().int().min(1_000).max(600_000).optional(),
  }),
  'silver.transform': z.object({
    targetTable: z.string().regex(/^[a-z0-9_]+$/),
    database: z.string().regex(/^[a-z0-9_]+$/),
    sourceTable: z.string().regex(/^[a-z0-9_]+$/).optional(),
    mode: z.enum(['full', 'incremental', 'refresh']).optional(),
  }),
  'gold.aggregate': z.object({
    targetTable: z.string().regex(/^[a-z0-9_]+$/),
    database: z.string().regex(/^[a-z0-9_]+$/),
    sourceTables: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(20).optional(),
  }),
} as const satisfies Record<JobOperation, z.ZodTypeAny>;

export interface SparkJobRunnerOptions {
  /** Python interpreter to use. */
  pythonBin?: string;
  /** Root of the repository (contains `src/lakehouse`). */
  repoRoot?: string;
  /** Hard timeout for the child process. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

let cachedRepoRoot: string | null = null;

/**
 * Locate the repository root — the directory that owns the Python package.
 *
 * The first implementation walked a fixed number of levels up from the
 * module URL. That works only when the module sits at exactly
 * `apps/api/src/lib/infra/spark/`, and it silently breaks in every other
 * layout:
 *
 *   - the worker container copies the sources to `/app/src/...`, so six
 *     levels up from the module is `/` and the child process started in the
 *     wrong directory and could not import `lakehouse.jobs.runner`;
 *   - a packaged deployment may mount the sources anywhere.
 *
 * The root is therefore *discovered* by walking up until the marker
 * directory is found, with an explicit environment override for deployments
 * that mount the sources differently.
 *
 * Two markers are accepted:
 *
 *   - `src/lakehouse` — the repository layout used on the developer machine;
 *   - `lakehouse-src/lakehouse` — the layout used by the worker container,
 *     where the Python package is mounted at a dedicated path so it cannot
 *     shadow the TypeScript `src/` tree.
 */
function findRepoRootByMarker(start: string): string | null {
  let dir = start;
  for (let depth = 0; depth < 10; depth += 1) {
    if (
      existsSync(join(dir, 'src', 'lakehouse')) ||
      existsSync(join(dir, 'lakehouse-src', 'lakehouse'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * The directory that contains the `lakehouse` Python package.
 *
 * `PYTHONPATH` must point at the *parent* of the package directory, which is
 * not always the repository root.
 */
function resolvePythonPath(repoRoot: string): string {
  if (existsSync(join(repoRoot, 'lakehouse-src', 'lakehouse'))) {
    return join(repoRoot, 'lakehouse-src');
  }
  return join(repoRoot, 'src');
}

function resolveRepoRoot(explicit?: string): string {
  if (explicit) return explicit;
  if (cachedRepoRoot) return cachedRepoRoot;

  // An explicit override wins: a deployment may mount the sources at a
  // path that does not follow the repository layout at all.
  const fromEnv = process.env.LAKEHOUSE_REPO_ROOT?.trim();
  if (fromEnv) {
    cachedRepoRoot = fromEnv;
    return cachedRepoRoot;
  }

  // The module URL is the most reliable starting point: it survives a
  // relocated deployment (`/app/src/lib/infra/spark/…`) where the process
  // working directory is not the repository root.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const fromModule = findRepoRootByMarker(moduleDir);
  if (fromModule) {
    cachedRepoRoot = fromModule;
    return cachedRepoRoot;
  }

  // Fall back to the working directory: the developer runs the worker from
  // `apps/api`, where the repository root is two levels up.
  const fromCwd = findRepoRootByMarker(process.cwd());
  if (fromCwd) {
    cachedRepoRoot = fromCwd;
    return cachedRepoRoot;
  }

  throw new AppError(
    500,
    'LAKEHOUSE_REPO_ROOT_NOT_FOUND',
    'Could not locate the lakehouse repository root (the directory that owns ' +
      'src/lakehouse). Set LAKEHOUSE_REPO_ROOT explicitly.',
  );
}

export const SparkJobRunner = {
  /**
   * Execute one whitelisted job and return the typed response.
   *
   * A non-zero exit code is NOT an error by itself — the runner prints a
   * machine-readable JSON result on stdout in both success and failure. Only
   * an unparseable/absent payload is a transport failure.
   */
  async run(request: JobRequest, options: SparkJobRunnerOptions = {}): Promise<JobResponse> {
    const paramsSchema = OperationParamsSchema[request.operation];
    if (!paramsSchema) {
      throw new AppError(400, 'UNSUPPORTED_JOB_OPERATION', `Unsupported operation: ${request.operation}`);
    }
    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      throw new AppError(
        400,
        'INVALID_JOB_PARAMS',
        `Invalid parameters for ${request.operation}`,
        parsedParams.error.issues,
      );
    }

    const repoRoot = resolveRepoRoot(options.repoRoot);
    const pythonBin = process.env.LAKEHOUSE_PYTHON ?? options.pythonBin ?? 'python3';
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const payload = JSON.stringify({
      operation: request.operation,
      jobId: request.jobId,
      params: parsedParams.data,
    });

    const startedAt = Date.now();
    const result = await this.spawnRunner(pythonBin, repoRoot, payload, timeoutMs);
    const elapsed = Date.now() - startedAt;

    const response = this.parseResponse(result.stdout, request.operation);
    logger.info(
      {
        operation: request.operation,
        jobId: request.jobId,
        status: response.status,
        rows: response.rows,
        elapsedMs: elapsed,
      },
      'Lakehouse job finished',
    );
    return response;
  },

  parseResponse(stdout: string, operation: string): JobResponse {
    const line = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('{'))
      .pop();
    if (!line) {
      throw new AppError(
        502,
        'LAKEHOUSE_JOB_NO_RESPONSE',
        `Job ${operation} did not return a result document.`,
      );
    }
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      throw new AppError(
        502,
        'LAKEHOUSE_JOB_INVALID_RESPONSE',
        `Job ${operation} returned an unparseable result document.`,
      );
    }
    const parsed = JobResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        502,
        'LAKEHOUSE_JOB_INVALID_RESPONSE',
        `Job ${operation} returned an unexpected result shape.`,
        parsed.error.issues,
      );
    }
    return parsed.data;
  },

  spawnRunner(
    pythonBin: string,
    repoRoot: string,
    payload: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      const pythonPath = resolvePythonPath(repoRoot);
      // argv array + no shell → the payload can never be interpreted by a shell.
      const child = spawn(pythonBin, ['-m', 'lakehouse.jobs.runner', payload], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PYTHONPATH: `${pythonPath}${process.env.PYTHONPATH ? `:${process.env.PYTHONPATH}` : ''}`,
          ENV: env.ENV,
          // An empty JAVA_HOME makes the Spark gateway fail to start, so the
          // variable is only forwarded when it actually points at a JDK.
          ...(process.env.JAVA_HOME ? { JAVA_HOME: process.env.JAVA_HOME } : {}),
        },
        shell: false,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(
          new AppError(
            504,
            'LAKEHOUSE_JOB_TIMEOUT',
            `The job exceeded its ${Math.round(timeoutMs / 1000)}s budget and was terminated.`,
          ),
        );
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(
          new AppError(
            503,
            'LAKEHOUSE_JOB_UNAVAILABLE',
            `Could not start the lakehouse job runner (${pythonBin}): ${err.message}`,
          ),
        );
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (stderr.trim()) {
          logger.warn({ stderr: stderr.slice(-4000) }, 'Lakehouse job runner stderr');
        }
        resolve({ stdout, stderr, code });
      });
    });
  },
};
