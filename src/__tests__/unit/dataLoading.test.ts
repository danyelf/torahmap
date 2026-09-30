import { describe, it, expect, vi } from 'vitest';
import { ready, isReady } from '../../dataLoading';
import { allVerseTexts } from '../../verseTexts';
import { tropOverlay } from '../../overlays/trop';
import { settingsFromLink } from '../../overlays/settings';

describe('ready', () => {
  it('runs a tool’s init once however often it is asked for', async () => {
    const init = vi.fn(async () => {});
    const tool = { id: 'fake', init };
    await Promise.all([ready(tool), ready(tool), ready(tool)]);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('counts a tool as ready only once its init has finished', async () => {
    let finish!: () => void;
    const tool = { id: 'slow', init: () => new Promise<void>((r) => (finish = r)) };
    const done = ready(tool);
    await Promise.resolve();
    expect(isReady(tool)).toBe(false);
    finish();
    await done;
    expect(isReady(tool)).toBe(true);
  });

  it('counts a tool with no init as ready from the start', () => {
    expect(isReady({ id: 'plain' })).toBe(true);
  });

  it('counts a failed init as finished, so nothing waits on it for ever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tool = { id: 'broken', init: () => Promise.reject(new Error('404')) };
    await ready(tool);
    expect(isReady(tool)).toBe(true);
    warn.mockRestore();
  });
});

describe('allVerseTexts', () => {
  it('downloads the texts once for every caller', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const [a, b] = await Promise.all([allVerseTexts(), allVerseTexts()]);
    expect(a).toBe(b);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes('all-texts')).length).toBe(1);
    fetchSpy.mockRestore();
  });
});

describe('trop init', () => {
  it('builds the trop index from the texts', async () => {
    await ready(tropOverlay);
    const colors = tropOverlay.colorsFor!(
      [{ book: 'Genesis', chapter: 1, verse: 1 }],
      settingsFromLink(tropOverlay, { trop: 'shalshelet' }),
      null,
    );
    expect(colors[0]).not.toBeNull();
  });
});
