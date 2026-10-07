import { type FC, useEffect, useRef, useState } from 'react';
import { cn } from '@/theme';
import { AMBIENT } from '@/assets';
import { useIsDesktop, useReducedMotion } from '@/hooks';

export interface AmbientLayerProps {
  className?: string;
  /**
   * Disable the pointer-following spotlight. Conic + noise still play.
   */
  disableSpotlight?: boolean;
}

const SPOTLIGHT_RADIUS_PX = 480;
const SPOTLIGHT_MAX_OPACITY = 0.28;

export const AmbientLayer: FC<AmbientLayerProps> = ({
  className,
  disableSpotlight = false,
}) => {
  const desktop = useIsDesktop();
  const reducedMotion = useReducedMotion();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const [opacityVar, setOpacityVar] = useState<string>('0');

  useEffect(() => {
    if (disableSpotlight || reducedMotion || !desktop) {
      setOpacityVar('0');
      return;
    }
    const layer = layerRef.current;
    if (!layer) return;

    const handlePointer = (e: PointerEvent) => {
      const rect = layer.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      targetRef.current.x = Math.max(0, Math.min(100, x));
      targetRef.current.y = Math.max(0, Math.min(100, y));
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          layer.style.setProperty('--pointer-x', `${targetRef.current.x}%`);
          layer.style.setProperty('--pointer-y', `${targetRef.current.y}%`);
          layer.style.setProperty('--pointer-active', '1');
          rafRef.current = null;
        });
      }
    };

    const handleLeave = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      layer.style.setProperty('--pointer-active', '0');
    };

    setOpacityVar(String(SPOTLIGHT_MAX_OPACITY));
    layer.addEventListener('pointermove', handlePointer, { passive: true });
    layer.addEventListener('pointerleave', handleLeave, { passive: true });
    return () => {
      layer.removeEventListener('pointermove', handlePointer);
      layer.removeEventListener('pointerleave', handleLeave);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [desktop, disableSpotlight, reducedMotion]);

  const noiseStyle = { '--ambient-noise-url': `url("${AMBIENT.Noise}")` } as React.CSSProperties;
  const spotlightStyle = {
    '--pointer-opacity': opacityVar,
    '--spotlight-radius': `${SPOTLIGHT_RADIUS_PX}px`,
  } as React.CSSProperties;

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ ...noiseStyle, ...spotlightStyle }}
    >
      <div
        className="ambient-conic absolute -inset-1/4 scale-150 blur-3xl"
        style={{ opacity: reducedMotion ? 0.35 : undefined }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(var(--spotlight-radius, 480px) circle at var(--pointer-x, 50%) var(--pointer-y, 50%), rgba(56,189,248,calc(var(--pointer-opacity, 0) * 0.6)), transparent 60%)',
          opacity: 'var(--pointer-opacity, 0)',
          transition: 'opacity 600ms ease-out',
        }}
      />
      <div className="ambient-noise absolute inset-0" />
    </div>
  );
};

export default AmbientLayer;