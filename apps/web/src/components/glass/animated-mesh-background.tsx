import { type FC, type ReactNode } from 'react';
import { cn } from '@/theme';

export type EMeshMode = 'light' | 'dark';

export interface AnimatedMeshBackgroundProps {
  /**
   * Color mode for the mesh blobs.
   * - 'dark': use vibrant colors with screen blending (for dark glass)
   * - 'light': use softer pastel colors with multiply blending (for light glass)
   */
  mode: EMeshMode;
  /**
   * Tint of the blobs. Default uses primary/cyan/violet which fits the lakehouse brand.
   * Pass 'accent' to align with the parent card's accent gradient.
   */
  variant?: 'default' | 'accent';
  /**
   * Optional className for outer wrapper.
   */
  className?: string;
}

interface BlobSpec {
  /** Container classes for position/size/shape/animation */
  className: string;
  /** Gradient color stops */
  gradient: string;
}

const DARK_BLOBS_DEFAULT: ReadonlyArray<BlobSpec> = [
  {
    className:
      'absolute -left-1/4 -top-1/4 size-[60%] rounded-full opacity-70 mix-blend-screen animate-aurora-1',
    gradient: 'bg-gradient-to-br from-primary-500/60 via-primary-400/40 to-transparent',
  },
  {
    className:
      'absolute right-0 top-1/4 size-[55%] rounded-full opacity-60 mix-blend-screen animate-aurora-2',
    gradient: 'bg-gradient-to-tl from-cyan-400/60 via-sky-300/30 to-transparent',
  },
  {
    className:
      'absolute bottom-0 left-1/4 size-[55%] rounded-full opacity-55 mix-blend-screen animate-aurora-3',
    gradient: 'bg-gradient-to-tr from-violet-500/55 via-fuchsia-400/30 to-transparent',
  },
];

const LIGHT_BLOBS_DEFAULT: ReadonlyArray<BlobSpec> = [
  {
    className:
      'absolute -left-1/4 -top-1/4 size-[60%] rounded-full opacity-75 mix-blend-color-burn animate-aurora-1',
    gradient: 'bg-gradient-to-br from-primary-500/45 via-primary-400/25 to-transparent',
  },
  {
    className:
      'absolute right-0 top-1/4 size-[55%] rounded-full opacity-70 mix-blend-color-burn animate-aurora-2',
    gradient: 'bg-gradient-to-tl from-cyan-500/45 via-sky-400/25 to-transparent',
  },
  {
    className:
      'absolute bottom-0 left-1/4 size-[55%] rounded-full opacity-60 mix-blend-color-burn animate-aurora-3',
    gradient: 'bg-gradient-to-tr from-violet-500/40 via-fuchsia-400/20 to-transparent',
  },
];

const DARK_BLOBS_ACCENT: ReadonlyArray<BlobSpec> = [
  {
    className:
      'absolute -left-1/4 -top-1/4 size-[60%] rounded-full opacity-70 mix-blend-screen animate-aurora-1',
    gradient: 'bg-gradient-to-br from-primary-500/70 via-primary-400/40 to-transparent',
  },
  {
    className:
      'absolute right-0 top-1/4 size-[55%] rounded-full opacity-60 mix-blend-screen animate-aurora-2',
    gradient: 'bg-gradient-to-tl from-cyan-400/65 via-sky-300/35 to-transparent',
  },
  {
    className:
      'absolute bottom-0 left-1/4 size-[55%] rounded-full opacity-55 mix-blend-screen animate-aurora-3',
    gradient: 'bg-gradient-to-tr from-violet-500/55 via-fuchsia-400/30 to-transparent',
  },
];

const LIGHT_BLOBS_ACCENT: ReadonlyArray<BlobSpec> = [
  {
    className:
      'absolute -left-1/4 -top-1/4 size-[60%] rounded-full opacity-80 mix-blend-color-burn animate-aurora-1',
    gradient: 'bg-gradient-to-br from-primary-500/50 via-primary-400/25 to-transparent',
  },
  {
    className:
      'absolute right-0 top-1/4 size-[55%] rounded-full opacity-70 mix-blend-color-burn animate-aurora-2',
    gradient: 'bg-gradient-to-tl from-cyan-500/50 via-sky-400/25 to-transparent',
  },
  {
    className:
      'absolute bottom-0 left-1/4 size-[55%] rounded-full opacity-60 mix-blend-color-burn animate-aurora-3',
    gradient: 'bg-gradient-to-tr from-violet-500/45 via-fuchsia-400/20 to-transparent',
  },
];

/**
 * AnimatedMeshBackground renders 3 gradient blobs that drift slowly behind the card
 * content, creating an "aurora" / glass-mesh effect.
 *
 * - Uses pure CSS keyframes (`animate-aurora-1/2/3`) — no external animation libs.
 * - Respects `prefers-reduced-motion: reduce` (animation is overridden in index.css).
 * - `pointer-events-none` so it never intercepts clicks on the card content.
 */
export const AnimatedMeshBackground: FC<AnimatedMeshBackgroundProps> = ({
  mode,
  variant = 'default',
  className,
}) => {
  const blobs =
    variant === 'accent'
      ? mode === 'dark'
        ? DARK_BLOBS_ACCENT
        : LIGHT_BLOBS_ACCENT
      : mode === 'dark'
        ? DARK_BLOBS_DEFAULT
        : LIGHT_BLOBS_DEFAULT;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden rounded-2xl',
        className,
      )}
    >
      {blobs.map((blob, idx) => (
        <div key={idx} className={cn(blob.className, blob.gradient)} />
      ))}
      {/* Subtle vignette to soften blob edges and keep text readable */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl',
          mode === 'dark'
            ? 'bg-gradient-to-br from-black/10 via-transparent to-black/30'
            : 'bg-gradient-to-br from-white/5 via-transparent to-white/15',
        )}
      />
    </div>
  );
};

export default AnimatedMeshBackground;

// Re-export for tree-shake safety
export type AnimatedMeshBackgroundChildren = ReactNode;