import type { ReactNode } from 'react';
import { GlassCard } from '@/components';
import { cn } from '@/theme';

export interface ScreenSectionProps {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function ScreenSection({ title, description, actions, children, className, padded = true }: ScreenSectionProps) {
  return (
    <GlassCard elevation={1} className={cn('flex h-full flex-col', className)}>
      <div className="flex items-start justify-between border-b border-white/5 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
            {title}
          </h2>
          {description !== undefined ? (
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
          ) : null}
        </div>
        {actions !== undefined ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('flex-1 overflow-auto', padded && 'p-5')}>{children}</div>
    </GlassCard>
  );
}
