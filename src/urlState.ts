// The browser's half of @torahmap/link: reading and writing the view state
// to and from the address bar, and suspending those writes while external
// state (a link being restored, a story stop) is being applied.

import { readLink, writeLink, type OverlayParamSpecLookup, type UrlState } from '@torahmap/link';

/** The view the current address names. */
export function parseUrlState(lookupOverlayParams?: OverlayParamSpecLookup): UrlState {
  return readLink(window.location.search, lookupOverlayParams);
}

/**
 * Whether a parsed link names any part of the view, as opposed to a query
 * string that carries only tracking parameters (utm_source, fbclid) neither
 * readLink nor writeLink recognizes. overlayParams is not checked: it is only
 * ever populated alongside an overlay, which is checked directly.
 */
export function linkNamesAView(state: UrlState): boolean {
  return (
    state.story !== undefined ||
    state.stop !== undefined ||
    state.overlay !== undefined ||
    state.verse !== undefined ||
    state.zoom !== undefined ||
    state.x !== undefined ||
    state.y !== undefined ||
    state.searchParams !== undefined
  );
}

// How many nested applyingExternalState() calls are in progress.
let urlWritesSuspended = 0;

/**
 * Run something that puts state *into* the app from outside — a link being
 * restored, a story stop being applied — with URL writes turned off.
 *
 * It blocks writes made synchronously inside `apply` and nothing else: a
 * control that calls onChange while being drawn would otherwise have
 * changeSettings write the URL midway through a restore or a story stop.
 * Deferred work, such as debouncedSaveUrlState or a scroll frame, runs after
 * this returns and is not covered.
 */
export function applyingExternalState<T>(apply: () => T): T {
  urlWritesSuspended++;
  try {
    return apply();
  } finally {
    urlWritesSuspended--;
  }
}

/** Whether URL writes are currently suspended. For tests and assertions. */
export function isApplyingExternalState(): boolean {
  return urlWritesSuspended > 0;
}

/**
 * Update the URL with new state. Does nothing while external state is being
 * applied — see applyingExternalState().
 *
 * pushHistory creates a new history entry, for a significant change like
 * overlay or verse; otherwise it replaces the current entry, for pan/zoom.
 * A URL that would not change is left alone, so it adds no history entry.
 */
export function updateUrl(state: UrlState, pushHistory: boolean = false): void {
  if (urlWritesSuspended > 0) return;
  const query = writeLink(state);
  if (query === window.location.search && !window.location.hash) return;
  const newUrl = window.location.pathname + query;

  if (pushHistory) {
    history.pushState(null, '', newUrl);
  } else {
    history.replaceState(null, '', newUrl);
  }
}

/** Back and Forward. The app writes the address only through updateUrl, which fires no event. */
export function subscribeToHistory(callback: () => void): void {
  window.addEventListener('popstate', callback);
}
