// A Talmud segment's colour while no tool colours it: Mishnah or Gemara.

import { type Color, brightnessJitter } from '@torahmap/utils';
import type { TalmudIdentity } from './types.ts';
import { isSegmentMishnah, type TalmudStructure } from './data.ts';
import { segmentHashId } from './segmentHash.ts';
import { MISHNAH_BASE_COLOR, GEMARA_BASE_COLOR, BRIGHTNESS_JITTER } from './constants.ts';

/** `quiet` gives the Mishnah the Gemara's colour, where its violet would crowd a tool's colors. */
export function mishnahOrGemaraColor(
  structure: TalmudStructure,
  id: TalmudIdentity,
  quiet = false,
): Color {
  const mishnah = isSegmentMishnah(structure, id.tractate, id.daf, id.amud, id.segment);
  return brightnessJitter(
    mishnah && !quiet ? MISHNAH_BASE_COLOR : GEMARA_BASE_COLOR,
    segmentHashId(id),
    BRIGHTNESS_JITTER,
  );
}
