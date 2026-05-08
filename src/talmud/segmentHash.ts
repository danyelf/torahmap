// Stable per-segment hash → seed for PRNGs (positional jitter in layout,
// brightness jitter in the M/G base overlay). Both consumers MUST use the
// same hash so the two random offsets are uncorrelated only via PRNG
// reseeding, not via two different hash schemes.

import type { TalmudIdentity } from "../types.ts";

export function segmentHash(
  tractate: string,
  daf: number,
  amud: "a" | "b",
  segment: number,
): number {
  let h = 0;
  for (let i = 0; i < tractate.length; i++) {
    h = (h * 31 + tractate.charCodeAt(i)) | 0;
  }
  h = (h * 31 + daf) | 0;
  h = (h * 31 + (amud === "b" ? 1 : 0)) | 0;
  h = (h * 31 + segment) | 0;
  return h;
}

export function segmentHashId(id: TalmudIdentity): number {
  return segmentHash(id.tractate, id.daf, id.amud, id.segment);
}
