// A verse square's colour while no tool colours it: a grey.

import { brightnessJitter, type Color } from '@torahmap/utils';

/** A grey, lighter or darker by the square's place, which reduces moiré. */
export function getDefaultColor(itemIndex: number): Color {
  return brightnessJitter([0.6, 0.6, 0.6], itemIndex * 3, 1 / 3);
}
