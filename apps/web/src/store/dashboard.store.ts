import { create } from 'zustand';

/**
 * The measurement window of the quality figures.
 *
 * MASTER PLAN §06.4 requires the quality figure to state its window and
 * forbids mixing windows. The backend implements two of the three windows
 * the plan names: `all` (every evaluated run) and `24h` (the rolling last
 * day). `latest-per-dataset` would need a different aggregation — one
 * rule check per `(datasetId, ruleVersion, snapshot)` instead of one per
 * run — so it is deliberately *not* offered: a selector that silently
 * approximated it would report a number measured over a population the
 * operator did not ask for.
 */
export type EDashboardQualityWindow = 'all' | '24h';

export interface DashboardState {
  /** The window the quality pass rate is measured over. */
  qualityWindow: EDashboardQualityWindow;
  setQualityWindow: (window: EDashboardQualityWindow) => void;
}

const QUALITY_WINDOW_KEY = 'lakehouse.dashboard.qualityWindow';

function readStored(): EDashboardQualityWindow {
  if (typeof window === 'undefined') return 'all';
  try {
    const stored = window.localStorage?.getItem(QUALITY_WINDOW_KEY);
    return stored === '24h' ? '24h' : 'all';
  } catch {
    return 'all';
  }
}

export const useDashboardStore = create<DashboardState>((set) => ({
  qualityWindow: readStored(),
  setQualityWindow: (qualityWindow) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(QUALITY_WINDOW_KEY, qualityWindow);
      } catch {
        // A storage failure must not break the screen — the window still
        // applies for this session, it just is not remembered.
      }
    }
    set({ qualityWindow });
  },
}));
