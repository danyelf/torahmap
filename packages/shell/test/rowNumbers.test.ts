import { describe, it, expect, beforeEach } from 'vitest';
import { createRowNumbers, type RowNumber } from '../src/rowNumbers.ts';

const ROWS: RowNumber[] = [
  { text: '1', x: 100, y: 0, zoom: 1 },
  { text: '2', x: 100, y: 12, zoom: 2 },
];

let parent: HTMLElement;
let move: (pan: { x: number; y: number }, zoom: number) => void;
beforeEach(() => {
  parent = document.createElement('div');
  move = createRowNumbers('numbers', ROWS, parent, { fontSize: 9, offset: 4, side: 'right' });
});

const container = () => parent.querySelector<HTMLElement>('#numbers')!;
const label = (text: string) =>
  [...parent.querySelectorAll<HTMLElement>('.row-number')].find((el) => el.textContent === text)!;
const hidden = (el: Element | null): boolean =>
  !!el && ((el as HTMLElement).style.display === 'none' || hidden(el.parentElement));
const shown = () => ROWS.map((r) => r.text).filter((t) => !hidden(label(t)));
const onScreen = (el: HTMLElement) => {
  const [x, y] = container()
    .style.transform.match(/-?[\d.]+/g)!
    .map(Number);
  return { x: x + parseFloat(el.style.left), y: y + parseFloat(el.style.top) };
};

describe('row numbers', () => {
  it('each show from its own zoom', () => {
    move({ x: 0, y: 0 }, 0.99);
    expect(shown()).toEqual([]);
    move({ x: 0, y: 0 }, 1);
    expect(shown()).toEqual(['1']);
    move({ x: 0, y: 0 }, 2);
    expect(shown()).toEqual(['1', '2']);
  });

  it('sit at their anchors as the map pans and zooms', () => {
    for (const [pan, zoom] of [
      [{ x: 0, y: 0 }, 2],
      [{ x: -40, y: 7 }, 2],
      [{ x: 15, y: -3 }, 3],
    ] as const) {
      move(pan, zoom);
      expect(onScreen(label('2'))).toEqual({ x: (100 + pan.x) * zoom, y: (12 + pan.y) * zoom });
    }
  });
});
