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

/** `quiet` gives the Mishnah the Gemara's colour, where its violet would crowd a tool's colors. */
export function mishnahOrGemaraColor(
  structure: TalmudStructure,
  id: TalmudIdentity,
  quiet = false,
): Color {
  const mishnah = isSegmentMishnah(structure, id.tractate, id.daf, id.amud, id.segment);
  return jitteredColor(mishnah && !quiet ? MISHNAH_BASE_COLOR : GEMARA_BASE_COLOR, id);
}
