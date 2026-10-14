// Squares too small to draw cleanly are widened into bars: each reaches across
// the gap to the next square on its row. The gaps are found here, once; the
// shader decides from the on-screen size how far to reach.

import type { MapItem } from './types.ts';
import { SQUARE_GAP } from './geometry.ts';

/**
 * The widest gap a bar crosses, as a fraction of the item's size. Measured on
 * both texts' layouts, gaps within a row run to 0.66 of a size, and the next
 * gap up, between columns, starts at 2.15.
 */
export const BAR_GAP_LIMIT = 1;

/**
 * For each item, the world units from its drawn right edge to the left edge
 * of its neighbour on the right, or 0 where it has none. A neighbour has the
 * same size, a top edge within half a size of the item's (layouts jitter
 * squares by less), and the nearest left edge to the right, no further than
 * BAR_GAP_LIMIT sizes away.
 */
export function gapsToRightNeighbour(items: readonly MapItem[]): Float32Array {
  const gaps = new Float32Array(items.length);
  // Items hashed by cell of their own size, so each search looks at a few cells
  const cells = new Map<string, number[]>();
  const cellOf = (v: number, size: number) => Math.floor(v / size);
  items.forEach((item, i) => {
    const key = `${item.size}:${cellOf(item.x, item.size)}:${cellOf(item.y, item.size)}`;
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  });

  items.forEach((item, i) => {
    const { x, y, size } = item;
    const right = x + size - SQUARE_GAP;
    const limit = BAR_GAP_LIMIT * size;
    const tolerance = size / 2;
    let best = Infinity;
    for (let cx = cellOf(x, size); cx <= cellOf(right + limit, size); cx++) {
      for (let cy = cellOf(y - tolerance, size); cy <= cellOf(y + tolerance, size); cy++) {
        for (const j of cells.get(`${size}:${cx}:${cy}`) ?? []) {
          const other = items[j];
          if (j === i || other.x <= x || Math.abs(other.y - y) >= tolerance) continue;
          const gap = other.x - right;
          if (gap <= limit && gap < best) best = gap;
        }
      }
    }
    if (best !== Infinity) gaps[i] = Math.max(0, best);
  });
  return gaps;
}
