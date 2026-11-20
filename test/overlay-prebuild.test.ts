import { describe, expect, it, vi } from 'vitest';
import { memoByValueAndLatestKey } from '@torahmap/utils';
import { optional, type Loaded } from '../packages/shell/src/dataFiles.ts';
import type { Overlay } from '../packages/shell/src/overlays/types.ts';
import { prebuildCompleted } from '../packages/shell/src/overlays/prebuild.ts';
import { testOverlay } from '../apps/tanakh/test/helpers/fixtures.ts';

/** A scheduler that runs nothing until told to, one turn at a time. */
function turns() {
  const queue: (() => void)[] = [];
  return { schedule: (run: () => void) => void queue.push(run), next: () => queue.shift()?.() };
}

const withPrebuild = (id: string, path: string, prebuild = vi.fn()) =>
  testOverlay({ id, name: id, data: { file: path }, prebuild });

describe('prebuildCompleted', () => {
  it('prebuilds one overlay per idle turn, each with its own data, nothing before the first', () => {
    const a = withPrebuild('a', 'a.json');
    const b = withPrebuild('b', 'b.json');
    const idle = turns();
    prebuildCompleted(
      [a, b],
      new Map(),
      () =>
        new Map([
          ['a.json', 1],
          ['b.json', 2],
        ]),
      () => {},
      idle.schedule,
    );
    expect(a.prebuild).not.toHaveBeenCalled();
    idle.next();
    expect(a.prebuild).toHaveBeenCalledWith({ file: 1 });
    expect(b.prebuild).not.toHaveBeenCalled();
    idle.next();
    expect(b.prebuild).toHaveBeenCalledWith({ file: 2 });
  });

  it('skips an overlay whose data is missing, and one with nothing to prebuild', () => {
    const missing = withPrebuild('m', 'missing.json');
    const plain = testOverlay({ id: 'p', name: 'p' });
    const idle = turns();
    prebuildCompleted(
      [missing, plain],
      new Map(),
      () => new Map(),
      () => {},
      idle.schedule,
    );
    idle.next();
    idle.next();
    expect(missing.prebuild).not.toHaveBeenCalled();
  });

  it('goes on to the next overlay when one prebuild throws', () => {
    const broken = withPrebuild(
      'x',
      'x.json',
      vi.fn(() => {
        throw new Error('broken');
      }),
    );
    const after = withPrebuild('y', 'y.json');
    const idle = turns();
    prebuildCompleted(
      [broken, after],
      new Map(),
      () =>
        new Map([
          ['x.json', 1],
          ['y.json', 2],
        ]),
      () => {},
      idle.schedule,
    );
    expect(() => idle.next()).toThrow('broken');
    idle.next();
    expect(after.prebuild).toHaveBeenCalledWith({ file: 2 });
  });

  it('skips an overlay whose data was complete before', () => {
    const a = withPrebuild('a', 'a.json');
    const loaded = new Map([['a.json', 1]]);
    const idle = turns();
    prebuildCompleted(
      [a],
      loaded,
      () => new Map([...loaded, ['other.json', 2]]),
      () => {},
      idle.schedule,
    );
    idle.next();
    expect(a.prebuild).not.toHaveBeenCalled();
  });

  it('says which overlay it built, after building it', () => {
    const a = withPrebuild('a', 'a.json');
    const settled = vi.fn(() => expect(a.prebuild).toHaveBeenCalled());
    const idle = turns();
    prebuildCompleted([a], new Map(), () => new Map([['a.json', 1]]), settled, idle.schedule);
    idle.next();
    expect(settled).toHaveBeenCalledWith(a, true);
  });

  it('says so when a prebuild throws, and still throws', () => {
    const broken = withPrebuild(
      'x',
      'x.json',
      vi.fn(() => {
        throw new Error('broken');
      }),
    );
    const settled = vi.fn();
    const idle = turns();
    prebuildCompleted([broken], new Map(), () => new Map([['x.json', 1]]), settled, idle.schedule);
    expect(() => idle.next()).toThrow('broken');
    expect(settled).toHaveBeenCalledWith(broken, false);
  });
});

interface Data {
  text: object;
  english: object | null;
}

const TEXT = { text: 'text.json' };
const ENGLISH = { english: 'english.json' };

/** An overlay that builds an index from its text and optional English, memoized as the Talmud's search is. */
function indexing() {
  const builds: string[] = [];
  const index = memoByValueAndLatestKey((_text: object, english: object | null) => {
    builds.push(english ? 'text+english' : 'text');
    return {};
  });
  const overlay = {
    id: 'indexing',
    name: 'indexing',
    data: { text: 'text.json', english: optional('english.json') },
    colorsFor: () => [],
    prebuild: ({ text, english }: Data) => void index(text, english),
  } as Overlay<object, never, Data>;
  return { overlay, builds, search: ({ text, english }: Data) => void index(text, english) };
}

/** Files landing one at a time, each hearing the loader's call, with an idle queue the test runs by hand. */
function session() {
  const { overlay, builds, search } = indexing();
  let loaded: Loaded = new Map();
  const queue: (() => void)[] = [];
  const settled: boolean[] = [];
  return {
    builds,
    settled,
    land(file: Record<string, string>) {
      const [[, path]] = Object.entries(file);
      const before = loaded;
      loaded = new Map(before).set(path, { path });
      prebuildCompleted(
        [overlay],
        before,
        () => loaded,
        (_, built) => settled.push(built),
        (run) => queue.push(run),
      );
    },
    /** What a search typed now does. */
    search() {
      search({
        text: loaded.get('text.json') as object,
        english: (loaded.get('english.json') as object | undefined) ?? null,
      });
    },
    idle() {
      while (queue.length > 0) queue.shift()?.();
    },
  };
}

describe('prebuildCompleted for an overlay with an optional file', () => {
  it('builds from the text alone, then again once the English lands, telling the loader each time', () => {
    const s = session();
    s.land(TEXT);
    s.idle();
    s.land(ENGLISH);
    s.idle();
    expect(s.builds).toEqual(['text', 'text+english']);
    expect(s.settled).toEqual([true, true]);
  });

  it('builds once from both when the English lands before the idle turn', () => {
    const s = session();
    s.land(TEXT);
    s.land(ENGLISH);
    s.idle();
    expect(s.builds).toEqual(['text+english']);
  });

  it('builds once from both when the English lands first', () => {
    const s = session();
    s.land(ENGLISH);
    s.land(TEXT);
    s.idle();
    expect(s.builds).toEqual(['text+english']);
  });

  it('builds nothing for the English alone', () => {
    const s = session();
    s.land(ENGLISH);
    s.idle();
    expect(s.builds).toEqual([]);
  });

  it('finds the index a search typed before the idle turn already built', () => {
    const s = session();
    s.land(TEXT);
    s.land(ENGLISH);
    s.search();
    s.idle();
    expect(s.builds).toEqual(['text+english']);
  });

  it('leaves a search typed after both prebuilds a ready index', () => {
    const s = session();
    s.land(TEXT);
    s.idle();
    s.land(ENGLISH);
    s.idle();
    s.search();
    expect(s.builds).toEqual(['text', 'text+english']);
  });
});
