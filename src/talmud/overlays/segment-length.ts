// Segment length overlay for the Talmud map.
//
// Pale yellow → dark red ramp based on segment character count.
// Paints both Mishnah and Gemara (per design doc §3.7 — overlays paint
// over both M and G substrates; length is computed the same way).

import type { Overlay } from "../../overlays/types.ts";
import type { TalmudIdentity } from "../../types.ts";
import type { TalmudStructure, TalmudTractateText } from "../data.ts";

type Color = [number, number, number];

const PALE: Color = [0.95, 0.95, 0.6];
const DARK: Color = [0.6, 0.15, 0.1];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lengthToColor(length: number, maxLength: number): Color {
  const t = Math.min(1, length / Math.max(1, maxLength));
  return [
    lerp(PALE[0], DARK[0], t),
    lerp(PALE[1], DARK[1], t),
    lerp(PALE[2], DARK[2], t),
  ];
}

// Module-level cache keyed by "Tractate:dafamud:seg" for fast lookup.
const lengthCache = new Map<string, number>();
let maxLength = 1;

function cacheKey(id: TalmudIdentity): string {
  return `${id.tractate}:${id.daf}${id.amud}:${id.segment}`;
}

/**
 * Populate the length cache from loaded tractate texts. Call once per
 * tractate after its text file loads.
 */
export function ingestTractateLengths(
  structure: TalmudStructure,
  text: TalmudTractateText,
): void {
  const tractate = structure.tractates.find((t) => t.name === text.name);
  if (!tractate) return;
  text.amudim.forEach((amudText, amudIdx) => {
    const amud = tractate.amudim[amudIdx];
    if (!amud) return;
    amudText.forEach((seg, segIdx) => {
      const key = `${text.name}:${amud.daf}${amud.amud}:${segIdx + 1}`;
      lengthCache.set(key, seg.length);
      if (seg.length > maxLength) maxLength = seg.length;
    });
  });
}

export const segmentLengthOverlay: Overlay<TalmudIdentity> = {
  id: "segment-length",
  name: "Segment Length",
  getVerseColor(id: TalmudIdentity): Color | null {
    const length = lengthCache.get(cacheKey(id));
    if (length === undefined) return null;
    return lengthToColor(length, maxLength);
  },
};
