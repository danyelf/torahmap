import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { legendHover } from '../../legendHover';
import { HOVER_LINGER_MS } from '../../utils/hover';

/** A stand-in for the map's hover: the verse hovered, and the setter the legend calls. */
function fakeMap() {
  const map = {
    hovered: null as string | null,
    setHovered: vi.fn((verse: string | null) => {
      map.hovered = verse;
    }),
  };
  return map;
}

function legendWith(...refs: string[]): { container: HTMLElement; entries: HTMLElement[] } {
  const container = document.createElement('div');
  const entries = refs.map((ref) => {
    const entry = document.createElement('span');
    entry.dataset.hoverVerse = ref;
    container.appendChild(entry);
    return entry;
  });
  return { container, entries };
}

const over = (target: Element) => ({ type: 'pointerover', pointerType: 'mouse', target });
const leave = (target: Element) => ({ type: 'pointerleave', pointerType: 'mouse', target });

describe('legendHover', () => {
  let map: ReturnType<typeof fakeMap>;
  let hover: ReturnType<typeof legendHover<string>>;

  beforeEach(() => {
    vi.useFakeTimers();
    map = fakeMap();
    hover = legendHover<string>({
      hovered: () => map.hovered,
      setHovered: map.setHovered,
      find: (ref) => (ref === 'missing' ? null : ref),
    });
  });
  afterEach(() => vi.useRealTimers());

  it("hovers an entry's verse, and clears it once the pointer has left the legend", () => {
    const { container, entries } = legendWith('Genesis.1.1');
    hover.handle(over(entries[0]));
    expect(map.hovered).toBe('Genesis.1.1');

    hover.handle(leave(container));
    vi.advanceTimersByTime(HOVER_LINGER_MS);
    expect(map.hovered).toBeNull();
  });

  it('leaves alone a hover the map set while the clear was pending', () => {
    const { container, entries } = legendWith('Genesis.1.1');
    hover.handle(over(entries[0]));
    hover.handle(leave(container));

    map.hovered = 'Genesis.49.24'; // the pointer reached the map
    vi.advanceTimersByTime(HOVER_LINGER_MS);

    expect(map.hovered).toBe('Genesis.49.24');
  });

  it('cancel clears its own hover at once, and nothing fires after', () => {
    const { container, entries } = legendWith('Genesis.1.1');
    hover.handle(over(entries[0]));
    hover.handle(leave(container));
    hover.cancel();
    expect(map.hovered).toBeNull();

    map.hovered = 'Genesis.49.24';
    vi.advanceTimersByTime(HOVER_LINGER_MS);
    expect(map.hovered).toBe('Genesis.49.24');
  });

  it("cancel leaves the map's own hover alone", () => {
    map.hovered = 'Genesis.49.24';
    hover.cancel();
    expect(map.setHovered).not.toHaveBeenCalled();
  });

  it('ignores touch, and treats an entry with no verse as off the legend', () => {
    const { entries } = legendWith('Genesis.1.1', 'missing');
    hover.handle({ ...over(entries[0]), pointerType: 'touch' });
    expect(map.hovered).toBeNull();

    hover.handle(over(entries[0]));
    hover.handle(over(entries[1]));
    vi.advanceTimersByTime(HOVER_LINGER_MS);
    expect(map.hovered).toBeNull();
  });
});
