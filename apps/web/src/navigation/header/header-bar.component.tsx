import { useState } from 'react';
import { cn } from '@/theme';
import { SearchBox } from './search-box.component';
import { LanguageToggle } from './language-toggle.component';
import { ThemeToggle } from './theme-toggle.component';
import type { HeaderBarProps } from '@/navigation';

export function HeaderBar({
  title,
  subtitle,
  searchPlaceholder,
  onSearch,
  searchValue,
  rightSlot,
}: HeaderBarProps) {
  const [internalSearch, setInternalSearch] = useState<string>(searchValue ?? '');

  const handleSearch = (value: string): void => {
    setInternalSearch(value);
    onSearch?.(value);
  };

  return (
    <header
      className={cn(
        'relative z-20 flex w-full flex-col items-center gap-3 px-6 py-4',
        'border-b border-white/5 bg-white/5 backdrop-blur-xl',
      )}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex-1" />
        {rightSlot !== undefined ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
      </div>

      <div className="flex w-full flex-col items-center gap-1.5 text-center">
        <h1
          className={cn(
            'text-2xl font-bold tracking-tight',
            'text-neutral-900 dark:text-neutral-50',
            'bg-gradient-to-r from-primary-500 via-primary-400 to-cyan-400',
            'bg-clip-text text-transparent',
          )}
        >
          {title}
        </h1>
        {subtitle !== undefined ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-center gap-3">
        <SearchBox
          value={internalSearch}
          onChange={handleSearch}
          placeholder={searchPlaceholder ?? 'Search tables, topics, DAGs...'}
        />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
