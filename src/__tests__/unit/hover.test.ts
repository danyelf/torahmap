import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lingeringHover, HOVER_LINGER_MS } from '../../utils/hover';

describe('lingeringHover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a target at once', () => {
    const show = vi.fn();
    lingeringHover(show).enter('a');
    expect(show).toHaveBeenCalledWith('a');
  });

  it('clears only once the pointer has been off every target for the linger', () => {
    const show = vi.fn();
    const hover = lingeringHover(show);
    hover.enter('a');
    hover.leave();

    vi.advanceTimersByTime(HOVER_LINGER_MS - 1);
    expect(show).not.toHaveBeenCalledWith(null);
    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenLastCalledWith(null);
  });

  it('never clears when the pointer crosses a gap onto the next target', () => {
    const show = vi.fn();
    const hover = lingeringHover(show);
    hover.enter('a');
    hover.leave();
    vi.advanceTimersByTime(HOVER_LINGER_MS / 2);
    hover.enter('b');
    vi.advanceTimersByTime(HOVER_LINGER_MS * 2);

    expect(show.mock.calls).toEqual([['a'], ['b']]);
  });

  it('forgets a pending clear when cancelled', () => {
    const show = vi.fn();
    const hover = lingeringHover(show);
    hover.enter('a');
    hover.leave();
    hover.cancel();
    vi.advanceTimersByTime(HOVER_LINGER_MS * 2);

    expect(show.mock.calls).toEqual([['a']]);
  });
});
