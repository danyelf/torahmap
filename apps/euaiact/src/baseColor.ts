// A square's colour while no tool colours it: its layer.

import { brightnessJitter, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER } from './constants.ts';
import { idHash } from './ids.ts';
import type { ActItem } from './layout.ts';

/** A colour from its hex digits. */
export const hex = (rgb: string): Color => [
  parseInt(rgb.slice(1, 3), 16) / 255,
  parseInt(rgb.slice(3, 5), 16) / 255,
  parseInt(rgb.slice(5, 7), 16) / 255,
];

export const RECITAL = hex('#b9a27a');
export const ARTICLE = hex('#9aa3ad');
export const ANNEX = hex('#5b8fc9');

export function layerColor(item: ActItem): Color {
  const base = item.layer === 'recital' ? RECITAL : item.layer === 'annex' ? ANNEX : ARTICLE;
  return brightnessJitter(base, idHash(item.id), BRIGHTNESS_JITTER);
}
