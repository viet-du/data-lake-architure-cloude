export type ELanguage = 'en' | 'vi';

export const SUPPORTED_LANGUAGES: ReadonlyArray<ELanguage> = ['en', 'vi'] as const;

export const DEFAULT_LANGUAGE: ELanguage = 'en';

export const LANGUAGE_LABELS: Readonly<Record<ELanguage, string>> = {
  en: 'EN',
  vi: 'VI',
};

export const LANGUAGE_NAMES: Readonly<Record<ELanguage, string>> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

export type Translation = typeof import('./locales/en.json');
