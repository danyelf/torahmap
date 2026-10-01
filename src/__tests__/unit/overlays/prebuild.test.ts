import { describe, expect, it, vi } from 'vitest';
import { prebuildCompleted } from '../../../overlays/prebuild';
import { testOverlay } from '../../helpers/fixtures';

/** A scheduler that runs nothing until told to, one turn at a time. */
function turns() {
  const queue: (() => void)[] = [];
  return { schedule: (run: () => void) => void queue.push(run), next: () => queue.shift()?.() };
}

const withPrebuild = (id: string, path: string, prebuild = vi.fn()) =>
  testOverlay({ id, name: id, getVerseColor: () => null, data: { file: path }, prebuild });

describe('prebuildCompleted', () => {
  it('prebuilds one overlay per idle turn, each with its own data, nothing before the first', () => {
    const a = withPrebuild('a', 'a.json');
    const b = withPrebuild('b', 'b.json');
    const idle = turns();
    prebuildCompleted(
      [a, b],
      new Map(),
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
    const plain = testOverlay({ id: 'p', name: 'p', getVerseColor: () => null });
    const idle = turns();
    prebuildCompleted([missing, plain], new Map(), new Map(), () => {}, idle.schedule);
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
      new Map([...loaded, ['other.json', 2]]),
      () => {},
      idle.schedule,
    );
    idle.next();
    expect(a.prebuild).not.toHaveBeenCalled();
  });

  it('says which overlay it built, after building it', () => {
    const a = withPrebuild('a', 'a.json');
    const built = vi.fn(() => expect(a.prebuild).toHaveBeenCalled());
    const idle = turns();
    prebuildCompleted([a], new Map(), new Map([['a.json', 1]]), built, idle.schedule);
    idle.next();
    expect(built).toHaveBeenCalledWith(a);
  });
});
