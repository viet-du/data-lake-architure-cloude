import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdaView } from '../eda/eda.view';
import { DQView } from '../dq/dq.view';

/**
 * Screen-level regression guard for the tab-bar-outside-provider bug.
 *
 * Both screens rendered `<TabsList>` **outside** `<TabsRoot>`. `TabsTrigger`
 * calls `useTabsContext()`, which throws when the provider is absent, so the
 * `ErrorBoundary` swallowed the whole screen and the user saw
 * "Something went wrong / Tabs subcomponents must be used inside <Tabs>".
 *
 * The test renders each screen and asserts that the tab bar is present and
 * that the error fallback is NOT.
 */

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  Link: ({ children }: { children: unknown }) => children,
  NavLink: ({ children }: { children: unknown }) => children,
  Navigate: () => null,
  BrowserRouter: ({ children }: { children: unknown }) => children,
  Routes: ({ children }: { children: unknown }) => children,
  Route: ({ children }: { children: unknown }) => children,
}));

/**
 * The queries are stubbed to their "idle, no data" shape. The screens must
 * render their chrome (including the tab bar) regardless of the data.
 *
 * The mock is built on `importOriginal` so that a hook this file does not
 * know about (a mutation, a preset check, …) keeps its real implementation
 * instead of throwing "No … export is defined on the mock" — which would
 * mask the very failure this test is meant to detect.
 */
const emptyQuery = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  status: 'pending' as const,
};

vi.mock('@/services/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/queries')>();
  return {
    ...actual,
    useEdaProfilesQuery: () => emptyQuery,
    useEdaProfileQuery: () => emptyQuery,
    useEdaProfileChartsQuery: () => emptyQuery,
    useEdaProfileSampleQuery: () => emptyQuery,
    useDQRulesQuery: () => emptyQuery,
    useDQSummaryQuery: () => emptyQuery,
    useDQRunsQuery: () => emptyQuery,
    useDQRuleQuery: () => emptyQuery,
    useDQPresetsQuery: () => emptyQuery,
    useDQFailedSamplesQuery: () => emptyQuery,
    useDQPresetCheckQuery: () => emptyQuery,
  };
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Render a screen inside a real `QueryClientProvider`.
 *
 * The screens use both queries and mutations; the mutation hooks call
 * `useQueryClient()`, which throws without a provider. Wrapping mirrors the
 * production tree exactly, so the test exercises the real hooks.
 */
function renderScreen(ui: ReactElement): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('EDA screen renders without falling into the error boundary', () => {
  it('shows the tab bar and not the "Something went wrong" fallback', () => {
    renderScreen(<EdaView />);

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tabs subcomponents must be used inside/)).not.toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
  });
});

describe('DQ screen renders without falling into the error boundary', () => {
  it('shows the tab bar and not the "Something went wrong" fallback', () => {
    renderScreen(<DQView />);

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tabs subcomponents must be used inside/)).not.toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);
  });
});
