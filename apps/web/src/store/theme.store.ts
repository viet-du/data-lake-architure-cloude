import { create } from 'zustand';

export type EThemeMode = 'light' | 'dark' | 'system';

export interface ThemeState {
  mode: EThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: EThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'lakehouse.theme';

function readStoredMode(): EThemeMode {
  if (typeof window === 'undefined') return 'system';
  if (window.localStorage === undefined || window.localStorage === null) return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    return 'system';
  }
  return 'system';
}

function resolveMode(mode: EThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyClass(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

const initialMode: EThemeMode = typeof window === 'undefined' ? 'system' : readStoredMode();
const initialResolved: 'light' | 'dark' = typeof window === 'undefined' ? 'light' : resolveMode(initialMode);
if (typeof window !== 'undefined') {
  applyClass(initialResolved);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolvedMode: initialResolved,
  setMode: (mode: EThemeMode) => {
    const resolved = resolveMode(mode);
    applyClass(resolved);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode);
    set({ mode, resolvedMode: resolved });
  },
  toggle: () => {
    const current = get().resolvedMode;
    const nextMode: EThemeMode = current === 'dark' ? 'light' : 'dark';
    const resolved = resolveMode(nextMode);
    applyClass(resolved);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, nextMode);
    set({ mode: nextMode, resolvedMode: resolved });
  },
}));
