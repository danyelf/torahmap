// URL hash state management for the Talmud map.
//
// Hash format: #segment=Berakhot:2a:1&overlay=segment-length
//
// Segment parsing is driven by TALMUD_SCHEMA via corpus-format so it stays
// in sync with the reference formatter.

import type { TalmudIdentity } from "../types.ts";
import { TALMUD_SCHEMA } from "../corpusSchema.ts";
import {
  parseFromUrlHash,
  serializeToUrlHash,
} from "../corpus-format.ts";

export interface TalmudUrlState {
  segment: TalmudIdentity | null;
  overlay: string | null;
}

export function parseTalmudUrlState(): TalmudUrlState {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);

  const segmentStr = params.get("segment");
  let segment: TalmudIdentity | null = null;
  if (segmentStr) {
    const parsed = parseFromUrlHash(segmentStr, TALMUD_SCHEMA);
    if (parsed) {
      segment = {
        tractate: parsed.tractate as string,
        daf: parsed.daf as number,
        amud: parsed.amud as "a" | "b",
        segment: parsed.segment as number,
      };
    }
  }

  const overlay = params.get("overlay");

  return {
    segment,
    overlay: overlay && overlay !== "none" ? overlay : null,
  };
}

export function buildTalmudUrlHash(state: TalmudUrlState): string {
  const params = new URLSearchParams();
  if (state.segment) {
    params.set("segment", serializeToUrlHash(state.segment, TALMUD_SCHEMA));
  }
  if (state.overlay) {
    params.set("overlay", state.overlay);
  }
  return params.toString();
}

export function updateTalmudUrl(state: TalmudUrlState): void {
  const hash = buildTalmudUrlHash(state);
  const newUrl = hash
    ? `${window.location.pathname}${window.location.search}#${hash}`
    : `${window.location.pathname}${window.location.search}`;
  if (newUrl !== window.location.href) {
    window.history.replaceState(null, "", newUrl);
  }
}
