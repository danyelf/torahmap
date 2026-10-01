import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dataFor,
  downloadFiles,
  filesFor,
  loadFiles,
  loadNamedFiles,
  optional,
  optionalFiles,
  overlayFiles,
  requiredFiles,
} from '../../dataFiles';
import { reportError } from '../../analytics';
import { mockFetch, mockFetchStatus } from '../helpers/mocks';
import { testOverlay } from '../helpers/fixtures';

vi.mock('../../analytics', () => ({ reportError: vi.fn() }));

const realFetch = globalThis.fetch;
beforeEach(() => vi.mocked(reportError).mockClear());
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

  it('leaves a failed download missing, reports it once with its path, and keeps the others', async () => {
    mockFetch({ '/data/good.json': { ok: true }, '/data/bad.json': mockFetchStatus(404) });
    const loaded = await loadFiles(['good.json', 'bad.json']);
    expect(loaded.has('good.json')).toBe(true);
    expect(loaded.has('bad.json')).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith('loadFiles', 404, expect.stringContaining('bad.json'));
  });

  it('reports a download that is refused or cannot be read, and leaves it missing', async () => {
    const offline = new Error('offline');
    globalThis.fetch = vi.fn(() => Promise.reject(offline)) as typeof fetch;
    expect((await loadFiles(['x.json'])).has('x.json')).toBe(false);
    expect(reportError).toHaveBeenCalledWith(
      'loadFiles',
      offline,
      expect.stringContaining('x.json'),
    );

    const garbled = new SyntaxError('Unexpected token');
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(garbled) } as Response),
    ) as typeof fetch;
    expect((await loadFiles(['y.json'])).has('y.json')).toBe(false);
    expect(reportError).toHaveBeenCalledWith(
      'loadFiles',
      garbled,
      expect.stringContaining('y.json'),
    );
  });
});

describe('downloadFiles', () => {
  it('hands each path over as it lands or as it fails, once, before resolving', async () => {
    mockFetch({ '/data/a.json': { a: 1 }, '/data/bad.json': mockFetchStatus(404) });
    const landed: [string, unknown][] = [];
    const failed: string[] = [];
    let resolved = false;
    await downloadFiles(['a.json', 'bad.json', 'a.json'], {
      landed: (path, content) => {
        expect(resolved).toBe(false);
        landed.push([path, content]);
      },
      failed: (path) => {
        expect(resolved).toBe(false);
        failed.push(path);
      },
    }).then(() => (resolved = true));
    expect(landed).toEqual([['a.json', { a: 1 }]]);
    expect(failed).toEqual(['bad.json']);
  });

  it('reports a throw while handling one file, with its path, and hands over the rest', async () => {
    mockFetch({
      '/data/a.json': 1,
      '/data/b.json': 2,
      '/data/bad.json': mockFetchStatus(404),
    });
    const broken = new Error('redraw');
    const landed: string[] = [];
    await downloadFiles(['a.json', 'b.json', 'bad.json'], {
      landed: (path) => {
        if (path === 'a.json') throw broken;
        landed.push(path);
      },
      failed: () => {
        throw broken;
      },
    });
    expect(landed).toEqual(['b.json']);
    expect(reportError).toHaveBeenCalledWith(
      'fileLanded',
      broken,
      expect.stringContaining('a.json'),
    );
    expect(reportError).toHaveBeenCalledWith(
      'fileLanded',
      broken,
      expect.stringContaining('bad.json'),
    );
  });
});

describe('loadNamedFiles', () => {
  it('rejects, naming the path, when a file fails', async () => {
    mockFetch({ '/data/good.json': { ok: true }, '/data/bad.json': mockFetchStatus(404) });
    await expect(loadNamedFiles({ a: 'good.json', b: 'bad.json' })).rejects.toThrow('bad.json');
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

  it('gives the same object while none of its own files changes, whatever else lands', () => {
    const loaded = new Map<string, unknown>([['all-texts.json', texts]]);
    const later = new Map(loaded).set('counts.json', { n: 1 });
    expect(dataFor(reader, later)).toBe(dataFor(reader, loaded));
  });

  it('gives a new object once one of its own files changes', () => {
    const loaded = new Map<string, unknown>([['all-texts.json', texts]]);
    const other = new Map<string, unknown>([['all-texts.json', { ...texts }]]);
    expect(dataFor(reader, other)).not.toBe(dataFor(reader, loaded));
  });

  it('hands an overlay that names no files undefined, never null', () => {
    const plain = testOverlay({ id: 'p', name: 'P', getVerseColor: () => null });
    expect(dataFor(plain, new Map())).toBeUndefined();
  });
});

describe('an optional file', () => {
  const texts = { Genesis: {} };
  const parse = { verses: {} };
  const reader = testOverlay({
    id: 'opt',
    name: 'Opt',
    getVerseColor: () => null,
    data: { texts: 'all-texts.json', parse: optional('parse.json') },
  });

  it('is not waited for: the data comes without it, holding null', () => {
    expect(dataFor(reader, new Map([['all-texts.json', texts]]))).toEqual({ texts, parse: null });
  });

  it('is handed over once it is in', () => {
    const loaded = new Map<string, unknown>([
      ['all-texts.json', texts],
      ['parse.json', parse],
    ]);
    expect(dataFor(reader, loaded)).toEqual({ texts, parse });
  });

  it('does not stand in for a file that is not optional', () => {
    expect(dataFor(reader, new Map([['parse.json', parse]]))).toBeNull();
  });

  it('gives a new object once it lands', () => {
    const without = new Map<string, unknown>([['all-texts.json', texts]]);
    const withIt = new Map(without).set('parse.json', parse);
    expect(dataFor(reader, withIt)).not.toBe(dataFor(reader, without));
  });

  it('is named apart from the files the overlay requires', () => {
    expect(requiredFiles(reader)).toEqual(['all-texts.json']);
    expect(optionalFiles(reader)).toEqual(['parse.json']);
  });

  it('is downloaded with the rest', () => {
    expect(overlayFiles([reader])).toEqual(['all-texts.json', 'parse.json']);
  });

  it('is not named as missing when the files are loaded by name', async () => {
    mockFetch({ '/data/all-texts.json': texts });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      loadNamedFiles({ texts: 'all-texts.json', parse: optional('parse.json') }),
    ).resolves.toEqual({ texts, parse: null });
  });
});
