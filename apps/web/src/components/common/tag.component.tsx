import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/theme';

export type ETagVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ETagVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Readonly<Record<ETagVariant, string>> = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  error: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  neutral: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30',
  primary: 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border-primary-500/30',
};

const DOT_CLASSES: Readonly<Record<ETagVariant, string>> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-neutral-500',
  primary: 'bg-primary-500',
};

const SIZE_CLASSES: Readonly<Record<'sm' | 'md', string>> = {
  sm: 'h-5 px-2 text-[10px] gap-1',
  md: 'h-6 px-2.5 text-xs gap-1.5',
};

export function Tag({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        'border backdrop-blur-sm',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full animate-pulse',
            DOT_CLASSES[variant],
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
