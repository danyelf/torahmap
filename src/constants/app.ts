// Application-wide constants

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

export const DEFAULT_ZOOM = 1.0;

// Debounced so pan/zoom doesn't flood browser history with replaceState calls
export const URL_UPDATE_DEBOUNCE_MS = 300;

// Terms shorter than this are dropped: too many false positives, too little gain
export const MIN_SEARCH_TERM_LENGTH = 2;

/**
 * What separates one search term from the next: English comma, Arabic comma,
 * left-to-right mark, Hebrew gershayim.
 *
 * Read both when a query string arrives and when the reader types, so that a
 * term can never hold a character that would later split it. They disagreed
 * once, and a term carrying a separator came back as two terms, which shifted
 * every later term's mode and meaning onto the wrong word.
 */
export const TERM_SEPARATORS = /[,،‎״]/;

export const SEARCH_SNIPPET_MAX_LENGTH = 60;
export const SEARCH_SNIPPET_CONTEXT_BEFORE = 20; // characters shown before the match

/**
 * How much larger the Hebrew in map labels is set than the label's nominal
 * size. David Libre's letter bodies stand 15% shorter than Noto Sans Hebrew's
 * at the same font-size (measured: 105.5px against 121.3px for מ, ב and ת set
 * at 200px), so Hebrew set at the old numbers reads smaller than it used to.
 * Applied after the zoom clamps, so MIN/MAX font sizes keep meaning the size a
 * label appears to be rather than the number handed to the font.
 */
export const HEBREW_LABEL_SCALE = 1.15;
