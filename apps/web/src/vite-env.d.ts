/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_ENABLE_MOCK?: string;
  readonly VITE_DEFAULT_LANG?: 'en' | 'vi';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
