import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { APP_CONFIG } from '@/config';
import { useAuthStore } from '@/store';

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
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
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}
