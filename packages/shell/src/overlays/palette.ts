// The colors the map lights words and picks in: one set for search terms, one for picks, so the
// two never share a color or step round each other.

import { maxChroma, oklchToRgb, type Color } from '@torahmap/utils';

/**
 * Every color is this light, so none looks brighter than another on the dark map, and no more
 * saturated than `CHROMA_CAP`, which holds the greens and yellows back to the strength the blues
 * and reds can reach.
 */
const LIGHTNESS = 0.74;
const CHROMA_CAP = 0.16;

const fromHues = (hues: readonly number[]): readonly Color[] =>
  hues.map((hue) =>
    oklchToRgb(LIGHTNESS, Math.min(0.92 * maxChroma(LIGHTNESS, hue), CHROMA_CAP), hue),
  );

/** OKLCH hues, each far from the one before it, the order a clashing word steps through them. */
export const TERM_PALETTE = fromHues([215, 50, 320, 125, 5]);

/** OKLCH hues in the order picks are handed them. */
export const PICK_PALETTE = fromHues([275, 165, 85, 245]);

/**
 * The first place below `size` not in `taken`, looking from place `from` on and wrapping round;
 * `from` again if all are taken.
 */
export function freeColor(taken: Iterable<number>, size: number, from = 0): number {
  const used = new Set(taken);
  for (let step = 0; step < size; step++) {
    const place = (from + step) % size;
    if (!used.has(place)) return place;
  }
  return from;
}
