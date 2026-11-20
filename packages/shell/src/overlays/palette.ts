// The colours the map lights words and picks in. A search term and a pick draw from this one set,
// so no two on the map share a colour.

import { maxChroma, oklchToRgb, type Color } from '@torahmap/utils';

/**
 * OKLCH hues, evenly spaced round the wheel and listed so that each is far from the next, wrap
 * included: a word whose colour is taken steps to the next in the list. Every colour is this
 * light, so none looks brighter than another on the dark map, and no more saturated than
 * `CHROMA_CAP`, which holds the greens and yellows back to the strength the blues and reds can reach.
 * The starting angle is the one whose closest pair is farthest apart on the dark map and under
 * red-green colour blindness.
 */
const HUES = [50, 170, 290, 110, 350, 230];
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

/** A random place in PALETTE not in `taken`; the first if all are taken. */
export function randomColor(taken: Iterable<number>): number {
  const used = new Set(taken);
  const free = PALETTE.map((_, place) => place).filter((place) => !used.has(place));
  return free.length ? free[Math.floor(Math.random() * free.length)] : 0;
}

/** FNV-1a: a short string hash that gives the same number everywhere. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/**
 * A word's own colour, as its place in PALETTE: the one its text hashes to, or the next in the
 * list that is not in `taken`. When all are taken, the word's own.
 */
export function colorFor(text: string, taken: Iterable<number>): number {
  const used = new Set(taken);
  const own = hashOf(text) % PALETTE.length;
  for (let step = 0; step < PALETTE.length; step++) {
    const place = (own + step) % PALETTE.length;
    if (!used.has(place)) return place;
  }
  return own;
}
