// A square's colour while no tool colours it: its layer.

import { brightnessJitter, hex, idHash, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER } from './constants.ts';
import type { ActItem } from './layout.ts';

export const RECITAL = hex('#b9a27a');
export const ARTICLE = hex('#9aa3ad');
export const ANNEX = hex('#4a6582');

export function layerColor(item: ActItem): Color {
  const base = item.layer === 'recital' ? RECITAL : item.layer === 'annex' ? ANNEX : ARTICLE;
  return brightnessJitter(base, idHash(item.id), BRIGHTNESS_JITTER);
}
