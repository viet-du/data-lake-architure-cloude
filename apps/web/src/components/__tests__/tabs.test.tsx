import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '../common/tabs.component';

afterEach(cleanup);

/** React logs the boundary error; silence it for the throwing cases. */
function withSilencedErrors<T>(fn: () => T): T {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe('Tabs composition contract', () => {
  it('renders a trigger inside TabsRoot and marks the active tab', () => {
    render(
      <TabsRoot value="a" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </TabsRoot>,
    );
    expect(screen.getByRole('tab', { name: 'Tab A' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tab B' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Panel A')).toBeVisible();
  });

  it('wires the tab to its panel for assistive technology', () => {
    render(
      <TabsRoot value="a" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </TabsRoot>,
    );
    const tab = screen.getByRole('tab', { name: 'Tab A' });
    const panel = screen.getByRole('tabpanel');
    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('calls onValueChange when a trigger is clicked', () => {
    const onValueChange = vi.fn();
    render(
      <TabsRoot value="a" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </TabsRoot>,
    );
    screen.getByRole('tab', { name: 'Tab B' }).click();
    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});

describe('Tabs subcomponents used outside TabsRoot', () => {
  /**
   * The regression guard.
   *
   * `TabsList`/`TabsTrigger`/`TabsContent` read the tabs context, so they
   * MUST be descendants of `TabsRoot`. When a screen renders the tab bar
   * outside the provider, the context is `null`, the hook throws, and the
   * whole screen is replaced by the error boundary.
   *
   * Both screen-level violations are asserted here: the bar itself and the
   * trigger. The message names the misplaced component so the failure is
   * actionable straight from the console.
   */
  it('throws for a trigger rendered outside TabsRoot', () => {
    withSilencedErrors(() => {
      expect(() =>
        render(
          <TabsList>
            <TabsTrigger value="a">Tab A</TabsTrigger>
          </TabsList>,
        ),
      ).toThrow(/Tabs subcomponents must be used inside <Tabs>/);
    });
  });

  it('throws for a tab bar rendered outside TabsRoot', () => {
    withSilencedErrors(() => {
      expect(() => render(<TabsList>{null}</TabsList>)).toThrow(
        /<TabsList> was rendered outside of <TabsRoot>/,
      );
    });
  });

  it('throws for a panel rendered outside TabsRoot', () => {
    withSilencedErrors(() => {
      expect(() => render(<TabsContent value="a">Panel A</TabsContent>)).toThrow(
        /<TabsContent> was rendered outside of <TabsRoot>/,
      );
    });
  });
});
