import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataFor, filesFor, loadFiles, overlayFiles } from '../../dataFiles';
import { mockFetch, mockFetchStatus } from '../helpers/mocks';
import { testOverlay } from '../helpers/fixtures';

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

describe('dataFor', () => {
  const texts = { Genesis: {} };
  const reader = testOverlay({
    id: 'r',
    name: 'R',
    getVerseColor: () => null,
    data: { texts: 'all-texts.json' },
  });
  const counter = testOverlay({
    id: 'c',
    name: 'C',
    getVerseColor: () => null,
    data: { words: 'all-texts.json' },
  });

  it('hands two overlays naming one path a single download, each under its own name', async () => {
    const fetchSpy = mockFetch({ '/data/all-texts.json': texts });
    const loaded = await loadFiles(overlayFiles([reader, counter]));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(dataFor(reader, loaded)).toEqual({ texts });
    expect(dataFor(counter, loaded)).toEqual({ words: texts });
  });

  it('gives null while a file is missing, without holding back another overlay', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = testOverlay({
      id: 'o',
      name: 'O',
      getVerseColor: () => null,
      data: { counts: 'counts.json' },
    });
    mockFetch({ '/data/counts.json': { n: 1 }, '/data/all-texts.json': mockFetchStatus(500) });
    const loaded = await loadFiles(overlayFiles([reader, other]));
    expect(dataFor(reader, loaded)).toBeNull();
    expect(dataFor(other, loaded)).toEqual({ counts: { n: 1 } });
  });

  it('gives the same object for the same loaded value, and a new one for a new value', () => {
    const loaded = new Map([['all-texts.json', texts]]);
    expect(dataFor(reader, loaded)).toBe(dataFor(reader, loaded));
    expect(dataFor(reader, new Map(loaded))).not.toBe(dataFor(reader, loaded));
  });

  it('hands an overlay that names no files undefined, never null', () => {
    const plain = testOverlay({ id: 'p', name: 'P', getVerseColor: () => null });
    expect(dataFor(plain, new Map())).toBeUndefined();
  });
});
