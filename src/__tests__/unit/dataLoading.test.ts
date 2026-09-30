import { describe, it, expect, vi } from 'vitest';
import { ready, isReady } from '../../dataLoading';

describe('ready', () => {
  it('runs a tool’s init once however often it is asked for', async () => {
    const init = vi.fn(async () => {});
    const tool = { name: 'fake', init };
    await Promise.all([ready(tool), ready(tool), ready(tool)]);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('counts a tool as ready only once its init has finished', async () => {
    let finish!: () => void;
    const tool = { name: 'slow', init: () => new Promise<void>((r) => (finish = r)) };
    const done = ready(tool);
    await Promise.resolve();
    expect(isReady(tool)).toBe(false);
    finish();
    await done;
    expect(isReady(tool)).toBe(true);
  });

  it('counts a tool with no init as ready from the start', () => {
    expect(isReady({ name: 'plain' })).toBe(true);
  });

  it('counts a failed init as finished, so nothing waits on it for ever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tool = { name: 'broken', init: () => Promise.reject(new Error('404')) };
    await ready(tool);
    expect(isReady(tool)).toBe(true);
    warn.mockRestore();
  });
});
