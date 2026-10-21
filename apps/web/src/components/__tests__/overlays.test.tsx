import '@testing-library/jest-dom';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Drawer } from '../common/drawer.component';
import { Modal } from '../common/modal.component';

afterEach(cleanup);
describe('overlays inside a clipped/transformed data panel', () => {
  it('renders the data drawer outside the ancestor and keeps Escape close behavior', () => {
    const close = vi.fn();
    const { container } = render(<div style={{ transform: 'translateY(0)', overflow: 'hidden', height: 100 }}><Drawer open onClose={close} title="Remote data"><p>table rows</p></Drawer></div>);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(container).not.toContainElement(screen.getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
  it('renders query modals outside the clipping ancestor', () => {
    const { container } = render(<div style={{ overflow: 'hidden', height: 100 }}><Modal open onClose={() => {}} title="SQL"><p>Query result</p></Modal></div>);
    expect(container).not.toContainElement(screen.getByRole('dialog'));
    expect(screen.getByText('Query result')).toBeVisible();
  });
});
