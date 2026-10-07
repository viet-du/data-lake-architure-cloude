import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../form/search-input.component';

describe('SearchInput', () => {
  it('renders with the provided value', () => {
    render(<SearchInput value="hello" onChange={() => {}} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange when typed into', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.input(input, { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
