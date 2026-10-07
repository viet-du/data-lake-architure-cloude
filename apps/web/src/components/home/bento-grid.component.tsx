import type { ReactNode } from 'react';
import { cn } from '@/theme';

export interface BentoGridProps {
  hero: ReactNode;
  quickStats: ReactNode;
  modules: ReactNode;
  activity: ReactNode;
  className?: string;
}

export function BentoGrid({ hero, quickStats, modules, activity, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid h-full w-full gap-4',
        'grid-cols-1 lg:grid-cols-3 xl:grid-cols-4',
        'auto-rows-min',
        className,
      )}
    >
      <div className="lg:col-span-2 xl:col-span-2 min-h-[260px]">
        {hero}
      </div>
      <div className="lg:col-span-1 xl:col-span-2 min-h-[260px]">
        {quickStats}
      </div>
      <div className="lg:col-span-2 xl:col-span-3 min-h-[420px]">
        {modules}
      </div>
      <div className="lg:col-span-1 xl:col-span-1 min-h-[420px]">
        {activity}
      </div>
    </div>
  );
}
