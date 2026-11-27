// A verse square's color while no tool colors it: a gray.

import { brightnessJitter, type Color } from '@torahmap/utils';

/** A gray, lighter or darker by the square's place, which reduces moiré. */
export function getDefaultColor(itemIndex: number): Color {
  return brightnessJitter([0.6, 0.6, 0.6], itemIndex * 3, 1 / 3);
}
