import { afterEach, describe, expect, it, vi } from 'vitest';
import { filesFor, loadFiles } from '../../dataFiles';
import { mockFetch, mockFetchStatus } from '../helpers/mocks';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('loadFiles', () => {
  it('downloads a path named twice only once', async () => {
    const fetchSpy = mockFetch({ '/data/shared.json': { a: 1 } });
    const loaded = await loadFiles(['shared.json', 'shared.json']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(loaded.get('shared.json')).toEqual({ a: 1 });
  });

  it('leaves a failed download missing, warns once, and keeps the others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch({ '/data/good.json': { ok: true }, '/data/bad.json': mockFetchStatus(404) });
    const loaded = await loadFiles(['good.json', 'bad.json']);
    expect(loaded.has('good.json')).toBe(true);
    expect(loaded.has('bad.json')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('bad.json');
  });

  it('treats a download that cannot be read as missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as typeof fetch;
    const loaded = await loadFiles(['x.json']);
    expect(loaded.has('x.json')).toBe(false);
  });
});

describe('filesFor', () => {
  const loaded = new Map<string, unknown>([
    ['a.json', 1],
    ['b.json', 2],
  ]);

  it('gives each file under the name it was asked for', () => {
    expect(filesFor({ first: 'a.json', second: 'b.json' }, loaded)).toEqual({
      first: 1,
      second: 2,
    });
  });

  it('gives null until every file named is in', () => {
    expect(filesFor({ first: 'a.json', third: 'c.json' }, loaded)).toBeNull();
  });
});
