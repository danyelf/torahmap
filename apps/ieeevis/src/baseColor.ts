// A square's colour while no tool colours it: paper text in grey, a placeholder dark with a dim ring.

import { brightnessJitter, type Color } from '@torahmap/utils';
import { BRIGHTNESS_JITTER, idHash, type PieceItem } from './layout.ts';

/** A colour from its hex digits. */
export const hex = (rgb: string): Color => [
  parseInt(rgb.slice(1, 3), 16) / 255,
  parseInt(rgb.slice(3, 5), 16) / 255,
  parseInt(rgb.slice(5, 7), 16) / 255,
];

export const TEXT = hex('#9aa3ad');
export const PLACEHOLDER = hex('#23272e');
export const PLACEHOLDER_RING = hex('#454c56');

export const isPlaceholder = (item: PieceItem): boolean => item.section === 'x';

/** `base` with the square's own brightness variation. */
export const jittered = (base: Color, item: PieceItem): Color =>
  brightnessJitter(base, idHash(item.id), BRIGHTNESS_JITTER);

export const baseColor = (item: PieceItem): Color =>
  isPlaceholder(item) ? PLACEHOLDER : jittered(TEXT, item);
