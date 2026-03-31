// Application-wide constants
// Extracted magic numbers with documentation explaining design choices

// === Data Loading ===

/**
 * Fetch a data file from public/data/.
 * Uses Vite's BASE_URL so the app works when deployed to a subdirectory.
 */
export function fetchData(filename: string): Promise<Response> {
  return fetch(`${import.meta.env.BASE_URL}data/${filename}`);
}

// === Layout Constants ===

/**
 * Position jitter range for verse squares
 * Applies random offset of ±1px to break up regular grid and reduce moiré patterns
 * Formula: (seededRandom() - JITTER_CENTER) * JITTER_RANGE
 */
export const JITTER_CENTER = 0.5;  // Center point for jitter calculation (produces range -0.5 to +0.5)
export const JITTER_RANGE = 2.0;   // Multiplier to scale to ±1px range

// === Camera/Zoom Constants ===

/**
 * Zoom step multipliers for mouse wheel
 * Chosen for smooth, intuitive zooming with mouse wheel
 */
export const ZOOM_OUT_FACTOR = 0.9;  // 10% zoom out per wheel tick
export const ZOOM_IN_FACTOR = 1.1;   // 10% zoom in per wheel tick

/**
 * Default zoom level (1:1 scale)
 */
export const DEFAULT_ZOOM = 1.0;

/**
 * Debounce delay for URL state updates during pan/zoom
 * Prevents excessive browser history entries during smooth interactions
 */
export const URL_UPDATE_DEBOUNCE_MS = 300;

// === Search Constants ===

/**
 * Minimum search term length (characters)
 * Terms shorter than this are filtered out to avoid performance issues
 * and excessive false positives
 */
export const MIN_SEARCH_TERM_LENGTH = 2;

/**
 * Maximum length of search result snippet (characters)
 * Keeps result previews concise and readable
 */
export const SEARCH_SNIPPET_MAX_LENGTH = 60;

/**
 * Context characters to show before match in snippet
 * Provides surrounding context while keeping snippet short
 */
export const SEARCH_SNIPPET_CONTEXT_BEFORE = 20;
