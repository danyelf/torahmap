// Structural M/G base overlay for the Talmud map.
//
// Talmud segments always carry a Mishnah-or-Gemara identity; we paint that
// distinction as the "default" color (parallel to getDefaultColor() on the
// Tanakh side, which colors verses by book section). Per-segment brightness
// jitter is folded in so the grid reads as living rainfall rather than flat
// tiles.
//
// `composeWithBase(userOverlay)` returns an Overlay that prefers the user's
// overlay color (when it has data for the segment) and falls back to the
// structural M/G paint.

import type { TalmudIdentity } from "../../types.ts";
import type { Overlay } from "../../overlays/types.ts";
import { isSegmentMishnah, type TalmudStructure } from "../data.ts";
import { seededRandom } from "../../utils/random.ts";
import { segmentHashId } from "../segmentHash.ts";
import {
  MISHNAH_BASE_COLOR,
  GEMARA_BASE_COLOR,
  BRIGHTNESS_JITTER,
} from "../constants.ts";

function jitteredColor(
  base: readonly [number, number, number],
  id: TalmudIdentity,
): [number, number, number] {
  // seededRandom returns [0,1); recenter to [-1,1] then scale.
  const j = (seededRandom(segmentHashId(id)) - 0.5) * 2 * BRIGHTNESS_JITTER;
  // Multiplicative jitter preserves hue; clamp to [0,1].
  const f = 1 + j;
  return [
    Math.max(0, Math.min(1, base[0] * f)),
    Math.max(0, Math.min(1, base[1] * f)),
    Math.max(0, Math.min(1, base[2] * f)),
  ];
}

export function createMgBaseOverlay(
  structure: TalmudStructure,
): Overlay<TalmudIdentity> {
  return {
    id: "_mg-base",
    name: "__internal",
    getVerseColor(id: TalmudIdentity) {
      const mishnah = isSegmentMishnah(
        structure,
        id.tractate,
        id.daf,
        id.amud,
        id.segment,
      );
      return jitteredColor(
        mishnah ? MISHNAH_BASE_COLOR : GEMARA_BASE_COLOR,
        id,
      );
    },
  };
}

/**
 * Wrap a user overlay so unmapped segments fall through to the M/G base
 * paint. `userOverlay` of null collapses to just the base.
 */
export function composeWithMgBase(
  base: Overlay<TalmudIdentity>,
  userOverlay: Overlay<TalmudIdentity> | null,
): Overlay<TalmudIdentity> {
  if (userOverlay === null) return base;
  return {
    id: "composed",
    name: "composed",
    getVerseColor(id: TalmudIdentity) {
      const c = userOverlay.getVerseColor(id);
      if (c !== null) return c;
      return base.getVerseColor(id);
    },
  };
}
