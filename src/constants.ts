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

/**
 * Position jitter for verse squares: (seededRandom() - JITTER_CENTER) * JITTER_RANGE
 * gives a ±1px offset that breaks up the regular grid and reduces moiré.
 */
export const JITTER_CENTER = 0.5;
export const JITTER_RANGE = 2.0;

export const ZOOM_OUT_FACTOR = 0.9; // 10% zoom out per wheel tick
export const ZOOM_IN_FACTOR = 1.1; // 10% zoom in per wheel tick

// Debounced so pan/zoom doesn't flood browser history with replaceState calls
export const URL_UPDATE_DEBOUNCE_MS = 300;

/** A verse's grey with no overlay: random within this range, to reduce moiré. */
export const DEFAULT_BRIGHTNESS = { MIN: 0.4, RANGE: 0.4 } as const;

/** The grey of a verse left out. */
export const DIMMED_GREY: Color = [0.18, 0.18, 0.18];

/** How a search shows over an overlay, judged by eye on the map. */
export const SEARCH_WITH_OVERLAY = {
  // What a verse the search does not match keeps of its overlay colour; above
  // about half, a warm search colour is lost among Haftarah's stripes
  NON_MATCH_DIM: 0.45,
} as const;

/** How long the map takes to cross-fade to a new picture: the front tool switching, or data landing. */
export const MAP_FADE = {
  DURATION_MS: 250,
} as const;
