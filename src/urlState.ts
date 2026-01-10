// URL State Management
// Handles parsing and serializing view state to/from URL hash

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
  if (overlay) state.overlay = overlay;

  const verse = params.get('verse');
  if (verse) state.verse = verse;

  const zoom = params.get('zoom');
  if (zoom) {
    const parsed = parseFloat(zoom);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 10) {
      state.zoom = parsed;
    }
  }

  const x = params.get('x');
  if (x) {
    const parsed = parseFloat(x);
    if (!isNaN(parsed)) state.x = parsed;
  }

  const y = params.get('y');
  if (y) {
    const parsed = parseFloat(y);
    if (!isNaN(parsed)) state.y = parsed;
  }

  // Overlay-specific parameters
  const trop = params.get('trop');
  if (trop) state.overlayParams.trop = trop;

  const category = params.get('category');
  if (category) state.overlayParams.category = category;

  const q = params.get('q');
  if (q) state.overlayParams.q = q;

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

  const verse = parseInt(parts.pop()!, 10);
  const chapter = parseInt(parts.pop()!, 10);
  const book = parts.join(' '); // Rejoin remaining parts as book name

  if (isNaN(verse) || isNaN(chapter) || !book) return null;

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

/**
 * Get the current full URL (for Copy Link functionality)
 */
export function getCurrentUrl(): string {
  return window.location.href;
}
