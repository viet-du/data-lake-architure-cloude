import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QuickStatCard } from '../quick-stat-card.component';
import { buildHomeQuickStats } from '@/screens/home/home.constants';
import { ROUTES } from '@/navigation/routes';
import type { DashboardMetric, EDashboardMetricStatus } from '@/types/entities';
import type { HomeQuickStat } from '../home.types';
import '@/i18n/config';

const timestamp = '2026-10-26T03:00:00Z';

function metric(
  value: number | null,
  status: EDashboardMetricStatus = value === null ? 'unavailable' : 'ok',
  window = 'live',
): DashboardMetric {
  return { value, status, source: 'test', window, asOf: timestamp, coverage: null };
}

function stats(overrides: Partial<Parameters<typeof buildHomeQuickStats>[0]> = {}) {
  return buildHomeQuickStats({
    totalTables: metric(13, 'ok', 'all-time'),
    runningJobs: metric(0),
    activeTopics: metric(9),
    activeDAGs: metric(1),
    recordsProcessed: metric(1063, 'ok', 'all-time'),
    qualityScore: metric(null, 'not_evaluated', 'all-evaluated-runs'),
    totalLag: metric(0),
    uptimeSeconds: 100,
    ...overrides,
  });
}

function byKey(list: ReadonlyArray<HomeQuickStat>, key: string): HomeQuickStat {
  const found = list.find((s) => s.key === key);
  if (!found) throw new Error(`missing stat ${key}`);
  return found;
}

function renderCard(stat: HomeQuickStat) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<QuickStatCard stat={stat} />} />
        <Route path={ROUTES.DQ} element={<div>DQ SCREEN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HOME Quick Stats — metric semantics', () => {
  it('HOME-002: a healthy Kafka with no topics shows 0, not Unavailable', () => {
    const topics = byKey(stats({ activeTopics: metric(0) }), 'topics');
    expect(topics.value).toBe('0');
    expect(topics.status).toBe('ok');
  });

  it('HOME-003: an unreachable Kafka shows an em dash and Unavailable, not 0', () => {
    const topics = byKey(stats({ activeTopics: metric(null, 'unavailable') }), 'topics');
    expect(topics.value).toBe('—');
    expect(topics.status).toBe('unavailable');
  });

  it('HOME-004: Kafka with topics shows the exact count', () => {
    expect(byKey(stats(), 'topics').value).toBe('9');
  });

  it('HOME-006: no DQ evaluation stays Not evaluated and never becomes a percentage', () => {
    const quality = byKey(stats(), 'quality');
    expect(quality.value).toBe('—');
    expect(quality.status).toBe('not_evaluated');
  });

  it('HOME-007: an evaluated DQ run shows its pass rate and no CTA', () => {
    const quality = byKey(
      stats({ qualityScore: metric(87.5, 'ok', 'all-evaluated-runs') }),
      'quality',
    );
    expect(quality.value).toBe('87.5%');
    expect(quality.status).toBe('ok');
    expect(quality.action).toBeUndefined();
  });

  it('HOME-010: a stale catalog keeps its last-known value and the stale status', () => {
    const tables = byKey(stats({ totalTables: metric(13, 'stale', 'all-time') }), 'tables');
    expect(tables.value).toBe('13');
    expect(tables.status).toBe('stale');
  });

  it('HOME-013: one failed provider does not corrupt the other cards', () => {
    const list = stats({ activeTopics: metric(null, 'unavailable') });
    expect(byKey(list, 'tables').value).toBe('13');
    expect(byKey(list, 'jobs').value).toBe('0');
    expect(byKey(list, 'dags').value).toBe('1');
    expect(byKey(list, 'records').value).not.toBe('—');
  });

  it('a missing metric is unavailable, never a guessed zero', () => {
    const list = stats({ activeDAGs: undefined });
    expect(byKey(list, 'dags').value).toBe('—');
    expect(byKey(list, 'dags').status).toBe('unavailable');
  });

  it('only the not_evaluated quality metric carries the Run Quality Check action', () => {
    expect(byKey(stats(), 'quality').action).toEqual({
      labelKey: 'home.quality_cta.run',
      path: ROUTES.DQ,
    });
    for (const key of ['tables', 'jobs', 'topics', 'dags', 'records']) {
      expect(byKey(stats(), key).action).toBeUndefined();
    }
    // An unavailable quality source is a fault, not an invitation to run DQ.
    expect(
      byKey(stats({ qualityScore: metric(null, 'unavailable') }), 'quality').action,
    ).toBeUndefined();
  });
});

describe('HOME Quick Stats — QuickStatCard rendering', () => {
  it('renders the Not evaluated badge and a Run Quality Check button', () => {
    renderCard(byKey(stats(), 'quality'));
    expect(screen.getByText('Not evaluated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Quality Check' })).toBeInTheDocument();
  });

  it('navigates to the Data Quality screen when the CTA is activated', () => {
    renderCard(byKey(stats(), 'quality'));
    fireEvent.click(screen.getByRole('button', { name: 'Run Quality Check' }));
    expect(screen.getByText('DQ SCREEN')).toBeInTheDocument();
  });

  it('renders the Unavailable badge for a failed source and no CTA', () => {
    renderCard(byKey(stats({ activeTopics: metric(null, 'unavailable') }), 'topics'));
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the Stale badge with the last-known value', () => {
    renderCard(byKey(stats({ totalTables: metric(13, 'stale', 'all-time') }), 'tables'));
    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('Total Tables')).toBeInTheDocument();
  });

  it('renders no badge and no button for a healthy metric', () => {
    renderCard(byKey(stats(), 'topics'));
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
