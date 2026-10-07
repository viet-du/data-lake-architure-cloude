import { BACKGROUNDS } from '@/assets';
import { useThemeStore } from '@/store';
import { cn } from '@/theme';

export interface BackgroundLayerProps {
  className?: string;
  overlay?: boolean;
  children?: React.ReactNode;
}

export function BackgroundLayer({ className, overlay = true, children }: BackgroundLayerProps) {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const backgroundUrl = BACKGROUNDS[resolvedMode];

  return (
    <div className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}>
      <img
        src={backgroundUrl}
        alt=""
        className="h-full w-full object-cover object-center"
        draggable={false}
        aria-hidden="true"
      />
      {overlay ? (
        <div
          className={cn(
            'absolute inset-0 transition-colors duration-500',
            resolvedMode === 'dark'
              ? 'bg-gradient-to-br from-black/40 via-black/20 to-black/40'
              : 'bg-gradient-to-br from-white/30 via-white/10 to-white/30',
          )}
        />
      ) : null}
      {children}
    </div>
  );
}
