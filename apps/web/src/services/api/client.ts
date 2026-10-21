import { ZodError } from 'zod';
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { APP_CONFIG } from '@/config';
import i18n from '@/i18n/config';
import { useAuthStore } from '@/store';

export interface ApiErrorBody {
  error: string | { code: string; message: string };
  message?: string;
}

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: APP_CONFIG.apiBaseUrl,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorBody>) => {
      if (error.response?.status === 401) {
        useAuthStore.getState().signOut();
      }
      if (axios.isAxiosError(error)) error.message = getErrorMessage(error);
      return Promise.reject(error);
    },
  );

  return instance;
}

export const apiClient = createClient();

export function unwrap<T>(payload: { data: T }): T {
  return payload.data;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return i18n.t('common.invalidResponse');
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.response?.status === 401) return i18n.t('common.unauthorized');
    if (error.response?.status === 403) return i18n.t(error.response.data?.error === 'DATABRICKS_PERMISSION_DENIED' ? 'databricks.permissionDenied' : 'common.forbidden');
    const body = error.response?.data;
    if (body && body.error !== null && typeof body.error === 'object') return body.error.message;
    if (body?.message) return body.message;
    if (error.response) return `HTTP ${error.response.status}: ${error.response.statusText}`;
    return i18n.t(error.code === 'ECONNABORTED' ? 'common.timeout' : 'common.networkError');
  }
  if (error instanceof Error) return error.message;
  return i18n.t('common.error');
}
