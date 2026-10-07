import { create } from 'zustand';

export type EUiDensity = 'comfortable' | 'compact';
export type EUiSidebar = 'expanded' | 'collapsed';

export interface UiState {
  density: EUiDensity;
  sidebar: EUiSidebar;
  setDensity: (density: EUiDensity) => void;
  setSidebar: (sidebar: EUiSidebar) => void;
  toggleSidebar: () => void;
}

const DENSITY_KEY = 'lakehouse.ui.density';
const SIDEBAR_KEY = 'lakehouse.ui.sidebar';

function readStored<T extends string>(key: string, allowed: ReadonlyArray<T>, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  if (window.localStorage === undefined || window.localStorage === null) return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null && (allowed as ReadonlyArray<string>).includes(stored)) {
      return stored as T;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

const initialDensity = readStored<EUiDensity>(DENSITY_KEY, ['comfortable', 'compact'], 'comfortable');
const initialSidebar = readStored<EUiSidebar>(SIDEBAR_KEY, ['expanded', 'collapsed'], 'expanded');

export const useUiStore = create<UiState>((set, get) => ({
  density: initialDensity,
  sidebar: initialSidebar,
  setDensity: (density) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(DENSITY_KEY, density);
    set({ density });
  },
  setSidebar: (sidebar) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_KEY, sidebar);
    set({ sidebar });
  },
  toggleSidebar: () => {
    const next: EUiSidebar = get().sidebar === 'expanded' ? 'collapsed' : 'expanded';
    if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_KEY, next);
    set({ sidebar: next });
  },
}));