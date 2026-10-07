import { env, DEFAULT_TIMEOUT_MS } from '@/config';
import { logger } from '@/lib/logger';

export interface AirflowFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
}

export class AirflowError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = 'AirflowError';
  }
}

export async function airflowFetch<T = unknown>(
  path: string,
  options: AirflowFetchOptions = {},
): Promise<T> {
  if (!env.AIRFLOW_BASE_URL) {
    throw new AirflowError(503, path, 'AIRFLOW_BASE_URL not configured');
  }

  const url = `${env.AIRFLOW_BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (env.AIRFLOW_USERNAME && env.AIRFLOW_PASSWORD) {
    const auth = Buffer.from(`${env.AIRFLOW_USERNAME}:${env.AIRFLOW_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {}
      logger.warn({ url, status: res.status }, 'Airflow request failed');
      throw new AirflowError(res.status, url, `Airflow returned ${res.status}`, parsed);
    }

    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  } finally {
    clearTimeout(timeout);
  }
}