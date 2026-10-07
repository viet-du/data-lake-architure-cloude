import { useCallback, useEffect, useState } from 'react';
import { DESKTOP_QUERY } from './breakpoints.constants';
import { useMediaQuery } from './use-media-query';

export interface StartViewTransitionOptions {
  skipAnimation?: boolean;
  types?: ReadonlyArray<string>;
}

export type StartViewTransitionFn = (
  callback: () => void | Promise<void>,
  options?: StartViewTransitionOptions,
) => void;

export interface UseViewTransitionResult {
  supported: boolean;
  reducedMotion: boolean;
  desktop: boolean;
  start: StartViewTransitionFn;
}

interface DocumentWithViewTransition extends Document {
  startViewTransition?: (
    cb: () => void | Promise<void>,
  ) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> };
}

export function useViewTransition(): UseViewTransitionResult {
  const [supported, setSupported] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const desktop = useMediaQuery(DESKTOP_QUERY);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const doc = document as DocumentWithViewTransition;
    setSupported(typeof doc.startViewTransition === 'function');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const start = useCallback<StartViewTransitionFn>(
    (callback, options) => {
      if (typeof document === 'undefined') {
        void callback();
        return;
      }
      const doc = document as DocumentWithViewTransition;
      const skip = options?.skipAnimation === true || reducedMotion || !desktop;
      if (skip || typeof doc.startViewTransition !== 'function') {
        void callback();
        return;
      }
      const types = options?.types;
      if (types && types.length > 0) {
        for (const name of types) {
          document.documentElement.style.setProperty(`--vt-${name}-duration`, '220ms');
        }
      }
      doc.startViewTransition(() => {
        const result = callback();
        return result;
      });
    },
    [desktop, reducedMotion],
  );

  return { supported, reducedMotion, desktop, start };
}
