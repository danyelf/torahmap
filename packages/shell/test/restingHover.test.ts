import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { restingHover, HOVER_REST_MS } from '../src/restingHover.ts';

describe('restingHover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('settles on a square only after the pointer rests on it', () => {
    const settle = vi.fn();
    const hover = restingHover<string>(settle);
    hover.move('a');
    vi.advanceTimersByTime(HOVER_REST_MS - 1);
    expect(settle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(settle).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('skips squares the pointer sweeps across', () => {
    const settle = vi.fn();
    const hover = restingHover<string>(settle);
    hover.move('a');
    vi.advanceTimersByTime(HOVER_REST_MS - 1);
    hover.move('b');
    vi.advanceTimersByTime(HOVER_REST_MS);
    expect(settle.mock.calls).toEqual([['b']]);
  });

  it('settles on nothing at once when the pointer leaves, dropping a square still waiting', () => {
    const settle = vi.fn();
    const hover = restingHover<string>(settle);
    hover.move('a');
    hover.move(null);
    expect(settle.mock.calls).toEqual([[null]]);
    vi.advanceTimersByTime(HOVER_REST_MS * 2);
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
