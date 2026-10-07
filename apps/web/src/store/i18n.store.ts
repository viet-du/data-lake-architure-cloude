import { create } from 'zustand';
import { setLanguage as setI18nLanguage, getCurrentLanguage } from '@/i18n';
import type { ELanguage } from '@/i18n';

export interface I18nState {
  language: ELanguage;
  setLanguage: (lang: ELanguage) => void;
  toggle: () => void;
}

const initialLanguage = getCurrentLanguage();

export const useI18nStore = create<I18nState>((set, get) => ({
  language: initialLanguage,
  setLanguage: (lang: ELanguage) => {
    setI18nLanguage(lang);
    set({ language: lang });
  },
  toggle: () => {
    const next: ELanguage = get().language === 'en' ? 'vi' : 'en';
    setI18nLanguage(next);
    set({ language: next });
  },
}));
