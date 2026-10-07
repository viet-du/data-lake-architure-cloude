import { cn } from '@/theme';
import { useI18nStore } from '@/store';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type ELanguage } from '@/i18n';
import type { LanguageToggleProps } from '@/navigation';

export function LanguageToggle({ className }: LanguageToggleProps) {
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={cn(
        'inline-flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur-md',
        className,
      )}
    >
      {SUPPORTED_LANGUAGES.map((lang: ELanguage) => {
        const active = language === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            aria-pressed={active}
            className={cn(
              'h-7 min-w-10 rounded-full px-3 text-xs font-semibold uppercase tracking-wider',
              'transition-all duration-200',
              active
                ? 'bg-primary-500/90 text-white shadow-md shadow-primary-500/30'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100',
            )}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
