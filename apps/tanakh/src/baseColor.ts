// A verse square's colour while no tool colours it: a grey.

import { seededRandom, type Color } from '@torahmap/utils';

/** The grey runs from MIN to MIN + RANGE. */
const BRIGHTNESS = { MIN: 0.4, RANGE: 0.4 } as const;

/**
 * Grey, lighter or darker by the square's place, which reduces moiré. This is not
 * `brightnessJitter` of a mid grey: the same range, but the last digit of some
 * squares' grey differs, and the colours stay as they were.
 */
export function getDefaultColor(itemIndex: number): Color {
  const brightness = BRIGHTNESS.MIN + seededRandom(itemIndex * 3) * BRIGHTNESS.RANGE;
  return [brightness, brightness, brightness];
}
