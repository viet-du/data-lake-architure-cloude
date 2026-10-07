import { useEffect, useState } from 'react';
import { DESKTOP_QUERY, MOBILE_QUERY, TABLET_QUERY } from './breakpoints.constants';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

export function useIsTablet(): boolean {
  return useMediaQuery(TABLET_QUERY);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
