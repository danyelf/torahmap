// The colours the map lights words and picks in. A search term and a pick draw from this one set,
// so no two on the map share a colour.

import { maxChroma, oklchToRgb, type Color } from '@torahmap/utils';

/**
 * OKLCH hues in the order they are handed out, each far from the ones before it. Every colour is
 * this light, so none looks brighter than another on the dark map, and no more saturated than
 * `CHROMA_CAP`, which holds the greens and yellows back to the strength the blues and reds can reach.
 */
const HUES = [215, 50, 320, 125, 5, 275, 165, 85, 245];
const LIGHTNESS = 0.74;
const CHROMA_CAP = 0.16;

export const PALETTE: readonly Color[] = HUES.map((hue) =>
  oklchToRgb(LIGHTNESS, Math.min(0.92 * maxChroma(LIGHTNESS, hue), CHROMA_CAP), hue),
);

/** The first colour not in `taken`, as its place in PALETTE; the first again if all are taken. */
export function freeColor(taken: Iterable<number>): number {
  const used = new Set(taken);
  const free = PALETTE.findIndex((_, place) => !used.has(place));
  return free < 0 ? 0 : free;
}
