import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/store';

const TRANSITION_CLASS = 'theme-transition';
const TRANSITION_MS = 200;

export function useThemeTransition(): void {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const previousMode = useRef(resolvedMode);

  useEffect(() => {
    if (previousMode.current === resolvedMode) return;
    previousMode.current = resolvedMode;
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add(TRANSITION_CLASS);
    const timer = window.setTimeout(() => {
      document.documentElement.classList.remove(TRANSITION_CLASS);
    }, TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [resolvedMode]);
}
