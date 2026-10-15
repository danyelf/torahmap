// Squares too small to draw cleanly are widened into bars: each reaches across
// the gap to the next square in its row. The gaps are found here, once; the
// shader decides from the on-screen size how far to reach.

import type { MapItem } from './types.ts';
import { SQUARE_GAP } from './geometry.ts';

/**
 * For each item, the world units from its drawn right edge to the left edge
 * of the next item to its right in the same row, or 0 where it has none or
 * no row.
 */
export function gapsToRightNeighbour(items: readonly MapItem[]): Float32Array {
  const gaps = new Float32Array(items.length);
  const rows = new Map<number, number[]>();
  items.forEach(({ row }, i) => {
    if (row === undefined) return;
    const members = rows.get(row);
    if (members) members.push(i);
    else rows.set(row, [i]);
  });
  for (const members of rows.values()) {
    members.sort((a, b) => items[a].x - items[b].x);
    for (let k = 0; k + 1 < members.length; k++) {
      const { x, size } = items[members[k]];
      gaps[members[k]] = Math.max(0, items[members[k + 1]].x - (x + size - SQUARE_GAP));
    }
  }
  return gaps;
}
