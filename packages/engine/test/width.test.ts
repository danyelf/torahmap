import { describe, expect, it } from 'vitest';
import {
  buildItemGeometry,
  buildOutlineGeometry,
  centreForFocus,
  findExactHit,
  findNearestItem,
  ITEM_OFFSETS,
  SQUARE_GAP,
} from '../src/index.ts';
import { createItem } from './fixtures.ts';

const tile = createItem({ id: 'tile', x: 100, y: 200, size: 6, width: 12 });
const square = createItem({ id: 'square', x: 100, y: 200, size: 6 });
const viewport = { width: 800, height: 600 };
const middle = { x: 400, y: 300 };

const rect = (item: ReturnType<typeof createItem>) => {
  const at = ITEM_OFFSETS.a_rect;
  return Array.from(buildItemGeometry([item]).slice(at, at + 4));
};
const rightEdge = (item: ReturnType<typeof createItem>) =>
  Math.max(...Array.from(buildOutlineGeometry(item, 2)).filter((_, i) => i % 2 === 0));

describe('an item wider than tall', () => {
  it('is drawn as wide as it says', () => {
    expect(rect(tile)).toEqual([100, 200, 100 + 12 - SQUARE_GAP, 200 + 6 - SQUARE_GAP]);
  });

  it('is hit across its whole width, and no further', () => {
    expect(findExactHit([tile], 111, 203)?.id).toBe('tile');
    expect(findExactHit([tile], 112, 203)).toBeNull();
  });

  it('has its centre in the middle of its width', () => {
    const other = createItem({ id: 'other', x: 118, y: 200, size: 6 });
    // x = 113 is 7 from the tile's middle (106) and 8 from other's (121); it
    // would be 10 from the tile's centre were the tile square (103).
    expect(findNearestItem([tile, other], 113, 203)?.id).toBe('tile');
  });

  it('is centred on screen at the middle of its width', () => {
    expect(centreForFocus(tile, 1, middle, viewport)).toEqual({ x: 106, y: 203 });
  });

  it('is outlined across its whole width', () => {
    expect(rightEdge(tile)).toBe(rightEdge(square) + 6);
  });
});

describe('an item with no width', () => {
  it('is drawn, hit and centred as a square', () => {
    expect(rect(square)).toEqual([100, 200, 100 + 6 - SQUARE_GAP, 200 + 6 - SQUARE_GAP]);
    expect(findExactHit([square], 105, 203)?.id).toBe('square');
    expect(findExactHit([square], 106, 203)).toBeNull();
    expect(centreForFocus(square, 1, middle, viewport)).toEqual({ x: 103, y: 203 });
  });
});
