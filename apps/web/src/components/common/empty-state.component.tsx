import { type ReactNode } from 'react';
import { cn } from '@/theme';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className,
      )}
    >
      {icon !== undefined ? (
        <div
          className={cn(
            'mb-4 flex items-center justify-center rounded-full bg-white/5 text-neutral-400 dark:text-neutral-500',
            compact ? 'h-12 w-12' : 'h-16 w-16',
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3
        className={cn(
          'font-semibold text-neutral-900 dark:text-neutral-100',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </h3>
      {description !== undefined ? (
        <p
          className={cn(
            'mt-1 max-w-md text-neutral-500 dark:text-neutral-400',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      ) : null}
      {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
