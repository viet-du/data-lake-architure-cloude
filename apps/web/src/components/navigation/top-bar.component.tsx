import { type FC, type ReactNode } from 'react';
import { cn } from '@/theme';

export interface TopBarProps {
  title: string;
  searchSlot?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
}

export const TopBar: FC<TopBarProps> = ({ title, searchSlot, rightSlot, className }) => {
  return (
    <header
      data-vt-topbar
      className={cn(
        'relative z-20 flex h-12 w-full items-center gap-4 px-4',
        'border-b border-white/5 bg-white/5 backdrop-blur-xl',
        'dark:border-white/5 dark:bg-black/20',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-inset ring-black/10"
            aria-hidden="true"
          />
          <span
            className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-inset ring-black/10"
            aria-hidden="true"
          />
          <span
            className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-inset ring-black/10"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <h1
          className={cn(
            'truncate text-base font-semibold',
            'text-black dark:text-white',
          )}
        >
          {title}
        </h1>
      </div>

      {searchSlot !== undefined ? (
        <div className="hidden max-w-md flex-1 md:flex">{searchSlot}</div>
      ) : null}

      {rightSlot !== undefined ? (
        <div className="flex items-center gap-2">{rightSlot}</div>
      ) : null}
    </header>
  );
};

export default TopBar;