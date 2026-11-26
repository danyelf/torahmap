// How far apart two verses sit in the canon, and the colour of each distance.

import { type Color, oklchToRgb } from '@torahmap/utils';
import { countedAs, getBookSection, type Place } from '../../books.ts';

// The two palest steps lie a little outside the screen's range, and are shown at its edge.
const onScreen = (lightness: number, chroma: number, hue: number): Color =>
  oklchToRgb(lightness, chroma, hue).map((c) => Math.min(1, Math.max(0, c))) as Color;

/** The steps of distance, nearest first. */
export const DISTANCE_STEPS: readonly { name: string; color: Color }[] = [
  { name: 'Same chapter', color: onScreen(0.54, 0.19, 300) },
  { name: 'Same book', color: onScreen(0.64, 0.22, 350) },
  { name: 'Same section of the Tanakh', color: onScreen(0.84, 0.15, 50) },
  { name: 'Another section', color: onScreen(0.96, 0.1, 95) },
];

export const SAME_CHAPTER = 0;

/** The index in DISTANCE_STEPS of how far verse `b` is from verse `a`. */
export function distanceStep(a: Place, b: Place): number {
  if (a.book === b.book && a.chapter === b.chapter) return SAME_CHAPTER;
  if (countedAs(a.book) === countedAs(b.book)) return 1;
  return getBookSection(a.book) === getBookSection(b.book) ? 2 : 3;
}
