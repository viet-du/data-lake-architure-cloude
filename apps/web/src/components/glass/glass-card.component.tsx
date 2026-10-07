import {
  type HTMLAttributes,
  type MouseEvent as ReactMouseEventHandler,
  type ReactNode,
  useCallback,
  useState,
} from 'react';
import { cn } from '@/theme';
import { useThemeStore } from '@/store';
import { AnimatedMeshBackground } from './animated-mesh-background';

export type EGlassElevation = 0 | 1 | 2 | 3 | 4 | 5;

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: EGlassElevation;
  /** Enables hover lift + glow + cursor-pointer. */
  hoverable?: boolean;
  /** Adds a colored ring around the card. */
  highlight?: boolean;
  /**
   * Render the animated mesh background (3 drifting gradient blobs).
   * Defaults to true. Disable for fully opaque cards.
   */
  animated?: boolean;
  /**
   * Apply a micro-tilt (max ±3deg) following the mouse position.
   * Defaults to false. Recommended only for compact cards (QuickStatCard).
   * Has no effect on touch devices.
   */
  tilt?: boolean;
  /**
   * Tilt intensity in degrees. Defaults to 3.
   */
  tiltIntensity?: number;
  children: ReactNode;
}

const ELEVATION_CLASSES: Readonly<Record<EGlassElevation, string>> = {
  0: 'shadow-none',
  1: 'shadow-sm shadow-black/5',
  2: 'shadow-md shadow-black/10',
  3: 'shadow-lg shadow-black/20',
  4: 'shadow-xl shadow-black/30',
  5: 'shadow-2xl shadow-black/40',
};

const HOVERABLE_BASE =
  'hover:-translate-y-1 hover:scale-[1.015] hover:border-white/40 dark:hover:border-white/25';
const HOVERABLE_DARK_SHADOW =
  'hover:shadow-[0_24px_60px_-15px_rgba(56,189,248,0.35),0_8px_24px_-8px_rgba(217,70,239,0.3)]';
const HOVERABLE_LIGHT_SHADOW =
  'hover:shadow-[0_24px_60px_-15px_rgba(14,165,233,0.25),0_8px_24px_-8px_rgba(168,85,247,0.18)]';

export function GlassCard({
  elevation = 2,
  hoverable = false,
  highlight = false,
  animated = true,
  tilt = false,
  tiltIntensity = 3,
  className,
  children,
  onMouseMove,
  onMouseLeave,
  style,
  ...rest
}: GlassCardProps) {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const isDark = resolvedMode === 'dark';
  const [tiltTransform, setTiltTransform] = useState<string>(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)',
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEventHandler<HTMLDivElement> extends infer E ? E : never) => {
      if (onMouseMove) {
        (onMouseMove as (e: unknown) => void)(event);
      }
      if (!tilt) return;
      // event is React.MouseEvent<HTMLDivElement>
      const e = event as unknown as MouseEvent & {
        currentTarget: HTMLDivElement;
      };
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateY = (x - 0.5) * 2 * tiltIntensity; // left/right tilt
      const rotateX = (y - 0.5) * -2 * tiltIntensity; // up/down tilt (inverted)
      setTiltTransform(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`,
      );
    },
    [tilt, tiltIntensity, onMouseMove],
  );

  const handleMouseLeave = useCallback(
    (event: unknown) => {
      if (onMouseLeave) {
        (onMouseLeave as (e: unknown) => void)(event);
      }
      if (!tilt) return;
      setTiltTransform(
        'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)',
      );
    },
    [tilt, onMouseLeave],
  );

  const tiltStyle = tilt
    ? {
        transform: tiltTransform,
        transition: 'transform 180ms ease-out',
        transformStyle: 'preserve-3d' as const,
      }
    : undefined;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ ...tiltStyle, ...style }}
      className={cn(
        'group relative overflow-hidden rounded-2xl',
        'backdrop-blur-2xl backdrop-saturate-200',
        'border transition-[transform,box-shadow,border-color,background-color] duration-500 ease-out',
        'will-change-transform',
        isDark
          ? 'bg-black/20 border-white/10 text-neutral-50'
          : 'bg-white/8 border-black/5 text-neutral-900',
        ELEVATION_CLASSES[elevation],
        hoverable && cn(
          'cursor-pointer',
          HOVERABLE_BASE,
          isDark ? HOVERABLE_DARK_SHADOW : HOVERABLE_LIGHT_SHADOW,
        ),
        highlight &&
          (isDark
            ? 'ring-1 ring-primary-400/50'
            : 'ring-1 ring-primary-500/50'),
        className,
      )}
      {...rest}
    >
      {animated && <AnimatedMeshBackground mode={isDark ? 'dark' : 'light'} />}
      {/* Top sheen — subtle gloss line at the top to enhance glass depth */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          isDark
            ? 'bg-gradient-to-r from-transparent via-white/30 to-transparent'
            : 'bg-gradient-to-r from-transparent via-black/5 to-transparent',
        )}
      />
      <div className="relative z-10" style={{ transform: 'translateZ(0)' }}>
        {children}
      </div>
    </div>
  );
}

export default GlassCard;