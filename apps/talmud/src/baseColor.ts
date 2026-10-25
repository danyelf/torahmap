// A Talmud segment's colour while no tool colours it: Mishnah or Gemara.

import { type Color, seededRandom } from '@torahmap/utils';
import type { TalmudIdentity } from './types.ts';
import { isSegmentMishnah, type TalmudStructure } from './data.ts';
import { segmentHashId } from './segmentHash.ts';
import { MISHNAH_BASE_COLOR, GEMARA_BASE_COLOR, BRIGHTNESS_JITTER } from './constants.ts';

function jitteredColor(
  base: readonly [number, number, number],
  id: TalmudIdentity,
): [number, number, number] {
  const j = (seededRandom(segmentHashId(id)) - 0.5) * 2 * BRIGHTNESS_JITTER;
  // Multiplied, so the hue holds.
  const f = 1 + j;
  return [
    Math.max(0, Math.min(1, base[0] * f)),
    Math.max(0, Math.min(1, base[1] * f)),
    Math.max(0, Math.min(1, base[2] * f)),
  ];
}

export function mishnahOrGemaraColor(structure: TalmudStructure, id: TalmudIdentity): Color {
  const mishnah = isSegmentMishnah(structure, id.tractate, id.daf, id.amud, id.segment);
  return jitteredColor(mishnah ? MISHNAH_BASE_COLOR : GEMARA_BASE_COLOR, id);
}

/** The same brightness with no hue: a Mishnah segment where the Mishnah's violet would crowd a tool's colors. */
export function grayOf([r, g, b]: Color): Color {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [gray, gray, gray];
}
