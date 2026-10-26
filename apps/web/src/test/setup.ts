import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
  if (typeof window === 'undefined') return;
  if (!('localStorage' in window) || window.localStorage === undefined) {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
  }

  // A plain function, not `vi.fn()`: in vitest 2.x `vi.restoreAllMocks()`
  // resets a `vi.fn()` implementation to `undefined`, which made every
  // later `matchMedia(...).matches` read throw. The stub is also installed
  // when an earlier stub exists but no longer returns a MediaQueryList.
  const needsMatchMedia =
    typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 0px)') === undefined;
  if (needsMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
