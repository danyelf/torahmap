// A square's colour while no tool colours it: paper text in grey, a placeholder dark with a dim ring.

import { brightnessJitter, hex, idHash, type Color } from '@torahmap/utils';
import type { Section } from './data.ts';
import { BRIGHTNESS_JITTER, type PieceItem } from './layout.ts';

export const TEXT = hex('#9aa3ad');
export const PLACEHOLDER = hex('#23272e');
export const PLACEHOLDER_RING = hex('#454c56');

/** A piece of a paper whose text is not loaded. */
export const PLACEHOLDER_SECTION = 'x' satisfies Section;

export const isPlaceholder = (item: PieceItem): boolean => item.section === PLACEHOLDER_SECTION;

/** `base` with the square's own brightness variation. */
export const jittered = (base: Color, item: PieceItem): Color =>
  brightnessJitter(base, idHash(item.id), BRIGHTNESS_JITTER);

export const baseColor = (item: PieceItem): Color =>
  isPlaceholder(item) ? PLACEHOLDER : jittered(TEXT, item);
