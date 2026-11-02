// A bar's colour while no tool colours it: one grey, its brightness varying by bar.

import { brightnessJitter, hex, idHash, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER } from './constants.ts';
import type { CodeItem } from './layout.ts';

export const BASE_GREY = hex('#9aa3ad');

export function baseColor(item: CodeItem): Color {
  return brightnessJitter(BASE_GREY, idHash(item.id), BRIGHTNESS_JITTER);
}
