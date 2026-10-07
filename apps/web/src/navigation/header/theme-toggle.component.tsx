import { cn } from '@/theme';
import { useThemeStore } from '@/store';
import type { ThemeToggleProps } from '@/navigation';

export function ThemeToggle({ className }: ThemeToggleProps) {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = resolvedMode === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'border border-white/10 bg-white/5 text-neutral-700 backdrop-blur-md',
        'transition-all duration-200',
        'hover:bg-white/10 hover:scale-105',
        'dark:text-neutral-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
        className,
      )}
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
