import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import vi from './locales/vi.json';
import { DEFAULT_LANGUAGE, type ELanguage, SUPPORTED_LANGUAGES } from './types';

const STORAGE_KEY = 'lakehouse.language';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export function setLanguage(lang: ELanguage): void {
  void i18n.changeLanguage(lang);
}

export function getCurrentLanguage(): ELanguage {
  const current = i18n.language;
  if (current.startsWith('vi')) return 'vi';
  return 'en';
}

export default i18n;
