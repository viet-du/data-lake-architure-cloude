import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tag } from '../common/tag.component';

describe('Tag', () => {
  it('renders children', () => {
    render(<Tag>hello</Tag>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies the variant class', () => {
    const { container } = render(<Tag variant="success">ok</Tag>);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/emerald|green/);
  });

  it('uses size sm when specified', () => {
    const { container } = render(<Tag size="sm">tiny</Tag>);
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/text-\[|h-/);
  });
});
