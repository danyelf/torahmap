// The browser's half of @torahmap/link: reading and writing the view state
// to and from the address bar, and suspending those writes while external
// state (a link being restored, a story stop) is being applied.

import { readLink, writeLink, type LinkKeys, type UrlState } from '@torahmap/link';

/** The view the current address names. */
export function parseUrlState(keys: LinkKeys): UrlState {
  return readLink(window.location.search, keys);
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
 * Deferred work, such as a debounced URL write or a scroll frame, runs after
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
export function updateUrl(state: UrlState, keys: LinkKeys, pushHistory: boolean = false): void {
  if (urlWritesSuspended > 0) return;
  const query = writeLink(state, keys);
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
