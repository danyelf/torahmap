// Global constants for the application

import type { Color } from '@torahmap/utils';

export const ZOOM_OUT_FACTOR = 0.9; // 10% zoom out per wheel tick
export const ZOOM_IN_FACTOR = 1.1; // 10% zoom in per wheel tick

// Debounced so pan/zoom doesn't flood browser history with replaceState calls
export const URL_UPDATE_DEBOUNCE_MS = 300;

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
