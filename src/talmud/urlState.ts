// URL hash state management for the Talmud map.
//
// Hash format: #segment=Berakhot:2a:1&overlay=segment-length
//
// Segment parsing is delegated to talmudFormat so it stays in sync with the
// reference formatter.

import type { TalmudIdentity } from "../types.ts";
import { talmudFormat } from "./format.ts";

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
    const parsed = talmudFormat.parseHash(segmentStr);
    if (parsed) {
      segment = parsed;
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
    params.set("segment", talmudFormat.serializeHash(state.segment));
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
