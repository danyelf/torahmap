// A bar's colour while no tool colours it: one grey, its brightness varying by bar.

import { brightnessJitter, hex, idHash, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER } from './constants.ts';

export const BASE_GREY = hex('#9aa3ad');

export function baseColor(id: string): Color {
  return brightnessJitter(BASE_GREY, idHash(id), BRIGHTNESS_JITTER);
}
