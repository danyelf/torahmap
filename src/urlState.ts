// URL State Management
// Handles parsing and serializing view state to/from URL hash

import { MIN_ZOOM, MAX_ZOOM } from './camera.ts';

/**
 * Overlay-specific parameters that can be stored in the URL
 */
export interface OverlayParams {
  /** Trop overlay: selected cantillation mark */
  trop?: string;
  /** Commentary overlay: selected category */
  category?: string;
  /** Search overlay: search query */
  q?: string;
}

/**
 * Validation constants
 */
const MAX_PAN_POSITION = 1000000; // Increased to support existing use cases
const MAX_STRING_LENGTH = 50;
const MAX_SEARCH_QUERY_LENGTH = 1000;

/**
 * Base validation - checks for XSS patterns and length
 * Returns null if invalid, trimmed string if valid
 */
function baseValidate(value: string | null, maxLength: number): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Check length
  if (trimmed.length > maxLength) return null;

  // Reject HTML tags and script injections
  if (/<[^>]*>/.test(trimmed)) return null;
  if (/javascript:/i.test(trimmed)) return null;
  if (/on\w+=/i.test(trimmed)) return null;

  return trimmed;
}

/**
 * Validate and sanitize a string parameter
 * Rejects HTML tags, scripts, and excessively long strings
 * Only allows alphanumeric characters, spaces, and hyphens
 */
function validateString(value: string | null, maxLength: number = MAX_STRING_LENGTH): string | null {
  const trimmed = baseValidate(value, maxLength);
  if (!trimmed) return null;

  // Reject path-like strings and special characters that could be used for injection
  if (/[/\\|;]/.test(trimmed)) return null;

  return trimmed;
}

/**
 * Validate category name - allows letters, spaces, slashes for subcategories
 * More permissive than validateString to support legacy categories
 */
function validateCategoryName(value: string | null): string | null {
  const trimmed = baseValidate(value, MAX_STRING_LENGTH);
  if (!trimmed) return null;

  // Allow letters, spaces, and slashes for categories like "Talmud/Mishnah"
  if (!/^[a-zA-Z\s/]+$/.test(trimmed)) return null;

  return trimmed;
}

/**
 * Validate book name in verse reference
 * Only allows letters, spaces, and dots (for I.Samuel format)
 */
function validateBookName(book: string): boolean {
  if (!book || book.trim() === '') return false;
  // Only allow letters (including Unicode), spaces, and dots
  return /^[a-zA-Z\u0590-\u05FF\s.]+$/.test(book);
}

/**
 * Strip HTML tags from search query
 */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Complete URL state representation
 */
export interface UrlState {
  /** Active overlay ID (undefined = no overlay) */
  overlay?: string;
  /** Selected verse in "Book.Chapter.Verse" format */
  verse?: string;
  /** Zoom level (default: 1.0) */
  zoom?: number;
  /** Pan X position (only used if no verse specified) */
  x?: number;
  /** Pan Y position (only used if no verse specified) */
  y?: number;
  /** Overlay-specific parameters */
  overlayParams: OverlayParams;
}

/**
 * Parse the current URL hash into a UrlState object
 */
export function parseUrlState(): UrlState {
  const hash = window.location.hash.slice(1); // Remove leading #
  const params = new URLSearchParams(hash);

  const state: UrlState = {
    overlayParams: {},
  };

  // Core parameters
  const overlay = params.get('overlay');
  const validatedOverlay = validateString(overlay);
  // Accept any validated overlay ID (for forward/backward compatibility)
  // The overlay registry will handle unknown IDs gracefully
  if (validatedOverlay) {
    state.overlay = validatedOverlay;
  }

  const verse = params.get('verse');
  const validatedVerse = validateString(verse, 100); // Allow longer for book names
  if (validatedVerse) state.verse = validatedVerse;

  const zoom = params.get('zoom');
  if (zoom) {
    const parsed = parseFloat(zoom);
    if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
      state.zoom = parsed;
    }
  }

  const x = params.get('x');
  if (x) {
    const parsed = parseFloat(x);
    if (!isNaN(parsed) && isFinite(parsed) && Math.abs(parsed) <= MAX_PAN_POSITION) {
      state.x = parsed;
    }
  }

  const y = params.get('y');
  if (y) {
    const parsed = parseFloat(y);
    if (!isNaN(parsed) && isFinite(parsed) && Math.abs(parsed) <= MAX_PAN_POSITION) {
      state.y = parsed;
    }
  }

  // Overlay-specific parameters
  const trop = params.get('trop');
  const validatedTrop = validateString(trop);
  if (validatedTrop) state.overlayParams.trop = validatedTrop;

  const category = params.get('category');
  const validatedCategory = validateCategoryName(category);
  if (validatedCategory) {
    state.overlayParams.category = validatedCategory;
  }

  const q = params.get('q');
  if (q) {
    // Search queries need HTML stripping but allow longer length
    const trimmed = q.trim();
    if (trimmed && trimmed.length <= MAX_SEARCH_QUERY_LENGTH) {
      state.overlayParams.q = stripHtmlTags(trimmed);
    }
  }

  return state;
}

/**
 * Build a URL hash string from state
 * Omits default values to keep URLs clean
 */
export function buildUrlHash(state: UrlState): string {
  const params = new URLSearchParams();

  // Core parameters (omit defaults)
  if (state.overlay) {
    params.set('overlay', state.overlay);
  }

  if (state.verse) {
    params.set('verse', state.verse);
  }

  if (state.zoom !== undefined && state.zoom !== 1.0) {
    // Round to 2 decimal places
    params.set('zoom', state.zoom.toFixed(2).replace(/\.?0+$/, ''));
  }

  // Only include pan if no verse (verse auto-centers)
  if (!state.verse) {
    if (state.x !== undefined) {
      params.set('x', state.x.toFixed(1).replace(/\.?0+$/, ''));
    }
    if (state.y !== undefined) {
      params.set('y', state.y.toFixed(1).replace(/\.?0+$/, ''));
    }
  }

  // Overlay-specific parameters
  if (state.overlayParams.trop) {
    params.set('trop', state.overlayParams.trop);
  }
  if (state.overlayParams.category && state.overlayParams.category !== 'all') {
    params.set('category', state.overlayParams.category);
  }
  if (state.overlayParams.q) {
    params.set('q', state.overlayParams.q);
  }

  const hash = params.toString();
  return hash ? `#${hash}` : '';
}

/**
 * Update the URL with new state
 * @param state - The new URL state
 * @param pushHistory - If true, creates a new history entry (for significant changes like overlay/verse)
 *                      If false, replaces current entry (for pan/zoom)
 */
export function updateUrl(state: UrlState, pushHistory: boolean = false): void {
  const hash = buildUrlHash(state);
  const newUrl = window.location.pathname + window.location.search + hash;

  if (pushHistory) {
    history.pushState(null, '', newUrl);
  } else {
    history.replaceState(null, '', newUrl);
  }
}

/**
 * Subscribe to hash/history changes (for browser back/forward)
 */
export function subscribeToHashChange(callback: () => void): void {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
}

/**
 * Convert verse reference to URL format
 * "I Samuel" 1:5 -> "I.Samuel.1.5"
 */
export function verseToUrlFormat(book: string, chapter: number, verse: number): string {
  const urlBook = book.replace(/ /g, '.');
  return `${urlBook}.${chapter}.${verse}`;
}

/**
 * Parse verse reference from URL format
 * "I.Samuel.1.5" -> { book: "I Samuel", chapter: 1, verse: 5 }
 */
export function parseVerseFromUrl(verseStr: string): { book: string; chapter: number; verse: number } | null {
  // Split from the end to handle book names with dots
  const parts = verseStr.split('.');
  if (parts.length < 3) return null;

  // Ensure we only have book.chapter.verse format (no extra dots)
  if (parts.length > 5) return null; // Allow for "I.Samuel" style names (max 3 parts for book + 2 for chapter/verse)

  const verseStr_ = parts.pop()!;
  const chapterStr = parts.pop()!;
  const book = parts.join(' '); // Rejoin remaining parts as book name

  const verse = parseInt(verseStr_, 10);
  const chapter = parseInt(chapterStr, 10);

  // Validate parsed numbers
  if (isNaN(verse) || isNaN(chapter)) return null;

  // Reject negative numbers
  if (verse < 0 || chapter < 0) return null;

  // Reject excessively large numbers (no book has >200 chapters, no chapter has >200 verses)
  if (chapter > 200 || verse > 200) return null;

  // Validate book name
  if (!validateBookName(book)) return null;

  return { book, chapter, verse };
}

/**
 * Create a debounced version of a function
 * Useful for pan/zoom URL updates
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

