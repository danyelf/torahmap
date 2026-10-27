import { describe, it, expect } from 'vitest';
import { createBookCovers } from '../src/bookCovers.ts';

const rects = [
  { minX: 0, minY: 0, maxX: 10, maxY: 20 },
  { minX: 30, minY: 5, maxX: 40, maxY: 15 },
];

describe('book covers', () => {
  it('shows a panel only while it has a tint', () => {
    const covers = createBookCovers('covers', rects, [[1, 0, 0], null], 0.1);
    const [first, second] = [...covers.el.children] as HTMLElement[];
    expect([first.hidden, second.hidden]).toEqual([false, true]);
    expect(first.style.getPropertyValue('--tint')).toBe('255,0,0');
    covers.tint(0, null);
    covers.tint(1, [0, 0, 1]);
    expect([first.hidden, second.hidden]).toEqual([true, false]);
  });

  it('places each panel by the zoom', () => {
    const covers = createBookCovers('covers', rects, [null, null], 0.1);
    covers.place(2);
    const second = covers.el.children[1] as HTMLElement;
    expect([second.style.left, second.style.top, second.style.width, second.style.height]).toEqual([
      '60px',
      '10px',
      '20px',
      '20px',
    ]);
  });
});
