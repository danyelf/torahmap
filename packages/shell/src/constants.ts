// Global constants for the application

import type { Color } from '@torahmap/utils';

/**
 * Fetch a data file from public/data/.
 * Uses Vite's BASE_URL so the app works when deployed to a subdirectory.
 *
 * Only Vite and vitest define import.meta.env, so a plain Node script importing
 * this module gets undefined and falls back to the site root. The scripts under
 * scripts/search/ run that way, serving public/ through their own fetch.
 */
export function fetchData(filename: string): Promise<Response> {
  return fetch(`${import.meta.env?.BASE_URL ?? '/'}data/${filename}`);
}

export const ZOOM_OUT_FACTOR = 0.9; // 10% zoom out per wheel tick
export const ZOOM_IN_FACTOR = 1.1; // 10% zoom in per wheel tick

// Debounced so pan/zoom doesn't flood browser history with replaceState calls
export const URL_UPDATE_DEBOUNCE_MS = 300;

/** A square's grey with no overlay: random within this range, to reduce moiré. */
export const DEFAULT_BRIGHTNESS = { MIN: 0.4, RANGE: 0.4 } as const;

/** The grey of a square left out. */
export const DIMMED_GREY: Color = [0.18, 0.18, 0.18];

/**
 * What a square a search does not match keeps of its overlay colour, judged by
 * eye on the map: above about half, a warm search colour is lost among
 * Haftarah's stripes.
 */
export const SEARCH_NON_MATCH_DIM = 0.45;

/** How long the map takes to cross-fade to a new picture: the front tool switching, or data landing. */
export const MAP_FADE = {
  DURATION_MS: 250,
} as const;
