import { useEffect, useRef, useState } from 'react';

export interface UseCountUpOptions {
  durationMs?: number;
  enabled?: boolean;
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { durationMs = 900, enabled = true } = options;
  const [value, setValue] = useState<number>(enabled ? 0 : target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, enabled]);

  return value;
}