// The browser's half of @torahmap/link: reading and writing the view state
// to and from the address bar, and suspending those writes while external
// state (a link being restored, a story stop) is being applied.

import { readLink, writeLink, type OverlayParamSpecLookup, type UrlState } from '@torahmap/link';

/** The view the current address names. */
export function parseUrlState(lookupOverlayParams?: OverlayParamSpecLookup): UrlState {
  return readLink(window.location.hash.slice(1), lookupOverlayParams);
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

  const hash = writeLink(state).replace(/^\?/, '#');
  if (hash === window.location.hash) return;
  const newUrl = window.location.pathname + window.location.search + hash;

  if (pushHistory) {
    history.pushState(null, '', newUrl);
  } else {
    history.replaceState(null, '', newUrl);
  }
}

/**
 * Subscribe to browser back/forward navigation.
 *
 * This app writes the URL only through history.pushState/replaceState (see
 * updateUrl above), never by assigning location.hash directly. Those calls
 * fire neither event on their own, so the only thing this needs to catch is
 * history traversal — which fires popstate every time, whether or not the
 * hash differs between entries. hashchange would fire for that too (when the
 * hash does differ, which pushHistory navigations arrange for), so adding it
 * only doubles up the same restore; it would only earn its place if something
 * changed location.hash directly, which nothing here does.
 */
export function subscribeToHashChange(callback: () => void): void {
  window.addEventListener('popstate', callback);
}
