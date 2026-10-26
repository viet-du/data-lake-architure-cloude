import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulePicker } from '../rule-picker.component';
import type { DQRule } from '@/types/entities';
// The components translate through the global i18next instance; it has to
// be initialised before the first render.
import '@/i18n/config';

/**
 * The rule picker replaces the free-text textarea that used to ask for
 * rule UUIDs. The user never had a way to learn a UUID from the UI, so
 * the suite form was effectively unusable.
 *
 * These tests pin the contract that matters:
 *   - the rules are listed with the information the user actually has;
 *   - clicking a rule toggles it in the selection;
 *   - the search narrows the list;
 *   - a dataset filter narrows the list;
 *   - errors and empty states are visible, never swallowed.
 */

function makeRule(overrides: Partial<DQRule> = {}): DQRule {
  return {
    ruleId: 'rule-1',
    tableName: 'lakehouse.bronze.customers',
    ruleName: 'customer_id is not null',
    ruleType: 'not_null',
    severity: 'high',
    status: 'unknown',
    expression: 'customer_id IS NOT NULL',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const rules: ReadonlyArray<DQRule> = [
  makeRule(),
  makeRule({
    ruleId: 'rule-2',
    ruleName: 'email format is valid',
    ruleType: 'regex',
    severity: 'low',
    columnName: 'email',
  }),
  makeRule({
    ruleId: 'rule-3',
    ruleName: 'orders amount is positive',
    tableName: 'lakehouse.bronze.orders',
    ruleType: 'range',
    severity: 'critical',
    columnName: 'amount',
  }),
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPicker(props: Partial<React.ComponentProps<typeof RulePicker>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <RulePicker
      rules={rules}
      isLoading={false}
      isError={false}
      selectedIds={[]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
}

describe('RulePicker', () => {
  it('lists the rules with their name, dataset and severity', () => {
    renderPicker();

    expect(screen.getByText('customer_id is not null')).toBeInTheDocument();
    expect(screen.getByText('email format is valid')).toBeInTheDocument();
    expect(screen.getByText('orders amount is positive')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('adds a rule to the selection when it is clicked', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText('customer_id is not null'));

    expect(onChange).toHaveBeenCalledWith(['rule-1']);
  });

  it('removes a rule from the selection when an already selected rule is clicked', () => {
    const { onChange } = renderPicker({ selectedIds: ['rule-1', 'rule-2'] });
    fireEvent.click(screen.getByText('customer_id is not null'));

    expect(onChange).toHaveBeenCalledWith(['rule-2']);
  });

  it('marks the selected rules as pressed', () => {
    renderPicker({ selectedIds: ['rule-1'] });

    const selected = screen
      .getByText('customer_id is not null')
      .closest('button');
    expect(selected).toHaveAttribute('aria-pressed', 'true');

    const other = screen.getByText('email format is valid').closest('button');
    expect(other).toHaveAttribute('aria-pressed', 'false');
  });

  it('narrows the list with the search box', () => {
    renderPicker();

    fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'email' } });

    expect(screen.queryByText('customer_id is not null')).not.toBeInTheDocument();
    expect(screen.getByText('email format is valid')).toBeInTheDocument();
  });

  it('narrows the list with the dataset filter', () => {
    renderPicker({ tableFilter: 'orders' });

    expect(screen.queryByText('customer_id is not null')).not.toBeInTheDocument();
    expect(screen.getByText('orders amount is positive')).toBeInTheDocument();
  });

  it('shows the number of selected rules', () => {
    renderPicker({ selectedIds: ['rule-1', 'rule-3'] });

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('shows the error and offers a retry', () => {
    const onRetry = vi.fn();
    renderPicker({
      rules: undefined,
      isError: true,
      error: new Error('rules unavailable'),
      onRetry,
    });

    expect(screen.getByText('rules unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state when there is no rule at all', () => {
    renderPicker({ rules: [] });

    expect(screen.getByText('No quality rules yet.')).toBeInTheDocument();
  });
});
