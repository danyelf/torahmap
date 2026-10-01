import { describe, expect, it, vi } from 'vitest';
import { prebuildAll } from '../../../overlays/prebuild';
import { testOverlay } from '../../helpers/fixtures';

/** A scheduler that runs nothing until told to, one turn at a time. */
function turns() {
  const queue: (() => void)[] = [];
  return { schedule: (run: () => void) => void queue.push(run), next: () => queue.shift()?.() };
}

const withPrebuild = (id: string, path: string, prebuild = vi.fn()) =>
  testOverlay({ id, name: id, getVerseColor: () => null, data: { file: path }, prebuild });

describe('prebuildAll', () => {
  it('prebuilds one overlay per idle turn, each with its own data, nothing before the first', () => {
    const a = withPrebuild('a', 'a.json');
    const b = withPrebuild('b', 'b.json');
    const idle = turns();
    prebuildAll(
      [a, b],
      new Map([
        ['a.json', 1],
        ['b.json', 2],
      ]),
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
    prebuildAll([missing, plain], new Map(), idle.schedule);
    idle.next();
    idle.next();
    expect(missing.prebuild).not.toHaveBeenCalled();
  });
});
