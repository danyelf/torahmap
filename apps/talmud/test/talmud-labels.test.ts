import { describe, it, expect, beforeEach } from 'vitest';
import { createTalmudLabels } from '../src/talmudLabels.ts';
import { DAF_LABEL_ZOOM_ALL, HADRAN_LABEL, PEREK_LABEL_ZOOM } from '../src/constants.ts';
import type { DafRowAnchor, HadranAnchor, PerekAnchor } from '../src/layout.ts';

const daf = (n: number, amud: 'a' | 'b', topY: number): DafRowAnchor => ({
  tractate: 'T',
  daf: n,
  amud,
  rightX: 100,
  topY,
});
const DAPIM = [daf(2, 'a', 0), daf(2, 'b', 6), daf(3, 'a', 12), daf(3, 'b', 18), daf(10, 'a', 24)];
const PEREK: PerekAnchor = { tractate: 'T', perekIdx: 0, hebrewName: 'פרק', rightX: 100, topY: 0 };
const HADRAN: HadranAnchor = { id: 'T.10a.4', x: 76, y: 26 };

let parent: HTMLElement;
let move: (pan: { x: number; y: number }, zoom: number) => void;
beforeEach(() => {
  parent = document.createElement('div');
  move = createTalmudLabels([], [PEREK], DAPIM, [HADRAN], parent);
});

const hidden = (el: Element | null): boolean =>
  !!el && ((el as HTMLElement).style.display === 'none' || hidden(el.parentElement));
const shownDapim = () =>
  [...parent.querySelectorAll<HTMLElement>('.row-number')]
    .filter((el) => !hidden(el))
    .map((el) => el.textContent);
/** Where an element sits on screen: its container's shift, then its own place. */
const onScreen = (el: HTMLElement) => {
  let shifted = el.parentElement!;
  while (!shifted.style.transform) shifted = shifted.parentElement!;
  const [x, y] = shifted.style.transform.match(/-?[\d.]+/g)!.map(Number);
  return { x: x + parseFloat(el.style.left), y: y + parseFloat(el.style.top) };
};

describe('daf numbers', () => {
  it('show with the perek names: every third daf first, then every amud', () => {
    move({ x: 0, y: 0 }, PEREK_LABEL_ZOOM - 0.01);
    expect(shownDapim()).toEqual([]);
    move({ x: 0, y: 0 }, PEREK_LABEL_ZOOM);
    expect(shownDapim()).toEqual(['3a', '10a']);
    move({ x: 0, y: 0 }, DAF_LABEL_ZOOM_ALL);
    expect(shownDapim().sort()).toEqual(['10a', '2a', '2b', '3a', '3b']);
  });

  it('sit at their anchors as the map pans and zooms', () => {
    const label = [...parent.querySelectorAll<HTMLElement>('.row-number')].find(
      (el) => el.textContent === '3b',
    )!;
    for (const [pan, zoom] of [
      [{ x: 0, y: 0 }, 2],
      [{ x: -40, y: 7 }, 2],
      [{ x: 15, y: -3 }, 3],
    ] as const) {
      move(pan, zoom);
      expect(onScreen(label)).toEqual({ x: (100 + pan.x) * zoom, y: (18 + pan.y) * zoom });
    }
  });
});

describe('hadran labels', () => {
  const label = () => parent.querySelector<HTMLElement>('#talmud-hadran-labels > *')!;
  /** How opaque the label is, from its own opacity and its containers'. */
  const opacity = (el: HTMLElement | null): number =>
    !el ? 1 : (el.style.opacity === '' ? 1 : Number(el.style.opacity)) * opacity(el.parentElement);

  it('fade out as the map zooms out', () => {
    const at = (zoom: number) => {
      move({ x: 0, y: 0 }, zoom);
      return hidden(label()) ? 0 : opacity(label());
    };
    const { fadesFrom, goneAt } = HADRAN_LABEL;
    expect(at(fadesFrom + 1)).toBe(1);
    expect(at(fadesFrom)).toBe(1);
    const half = at((fadesFrom + goneAt) / 2);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(at((fadesFrom + 3 * goneAt) / 4)).toBeLessThan(half);
    expect(at(goneAt)).toBe(0);
    expect(at(goneAt - 0.01)).toBe(0);
  });

  it('sit left of their square, at its middle, moving with the map', () => {
    move({ x: 5, y: 10 }, 2);
    expect(onScreen(label())).toEqual({ x: (HADRAN.x + 5) * 2, y: (HADRAN.y + 10) * 2 });
    expect(label().textContent).not.toBe('');
  });
});

describe('perek names', () => {
  it('show from their zoom, above their first row, moving with the map', () => {
    const name = parent.querySelector<HTMLElement>('#talmud-perek-labels > *')!;
    move({ x: 0, y: 0 }, PEREK_LABEL_ZOOM - 0.01);
    expect(hidden(name)).toBe(true);
    move({ x: 5, y: 10 }, 1);
    expect(hidden(name)).toBe(false);
    expect(onScreen(name)).toEqual({ x: 105, y: 8 });
  });
});
