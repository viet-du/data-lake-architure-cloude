const DEFAULT_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_TIMEOUT = 15_000;

function getBaseUrl(): string {
  return (process.env.AIRFLOW_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getAuthHeader(): string | null {
  const user = process.env.AIRFLOW_USERNAME;
  const pass = process.env.AIRFLOW_PASSWORD;
  if (user && pass) {
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  return null;
}

function getExtraHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  if (process.env.AIRFLOW_API_KEY) {
    out.Authorization = `Bearer ${process.env.AIRFLOW_API_KEY}`;
  } else {
    const basic = getAuthHeader();
    if (basic) out.Authorization = basic;
  }
  return out;
}

export interface AirflowRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export class AirflowClient {
  private baseUrl: string;
  private extraHeaders: Record<string, string>;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = getBaseUrl();
    this.extraHeaders = getExtraHeaders();
    this.timeoutMs = Number(process.env.AIRFLOW_TIMEOUT_MS ?? DEFAULT_TIMEOUT);
  }

  getConfig(): { baseUrl: string; hasAuth: boolean; timeoutMs: number } {
    return {
      baseUrl: this.baseUrl,
      hasAuth: Object.keys(this.extraHeaders).length > 0,
      timeoutMs: this.timeoutMs,
    };
  }

  async request<T>(opts: AirflowRequestOptions): Promise<T> {
    const url = this.buildUrl(opts.path, opts.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...this.extraHeaders,
      };
      const init: RequestInit = {
        method: opts.method,
        headers,
        signal: controller.signal,
      };
      if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      const res = await fetch(url, init);
      if (res.status === 204) {
        return undefined as T;
      }
      const text = await res.text();
      const data = text ? safeJsonParse(text) : undefined;
      if (!res.ok) {
        const detail =
          (data && typeof data === 'object' && 'detail' in data
            ? String((data as { detail: unknown }).detail)
            : null) ?? res.statusText;
        throw new Error(`Airflow ${opts.method} ${opts.path} -> ${res.status}: ${detail}`);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${this.baseUrl}${cleanPath}`;
    if (!query) return fullUrl;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${fullUrl}?${qs}` : fullUrl;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let instance: AirflowClient | null = null;

export const AirflowClientSingleton = {
  get(): AirflowClient {
    if (!instance) instance = new AirflowClient();
    return instance;
  },
  reset(): void {
    instance = null;
  },
};