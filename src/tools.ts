// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, Tools } from './overlays/types.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';
import { isReady } from './dataLoading.ts';

/**
 * The tools a view asks for, the overlay if one is on and the search while it
 * has a word to search on, and which of them it shows: those whose data is in.
 */
export function toolsToShow(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): { tools: Tools; allLoaded: boolean } {
  const searchAsked = isSearching(search);
  const overlayIn = overlay !== null && isReady(overlay);
  const searchIn = searchAsked && isReady(searchTool);
  return {
    tools: {
      overlay: overlayIn ? { tool: overlay, settings: overlaySettings } : null,
      search: searchIn ? { tool: searchTool, settings: search } : null,
    },
    allLoaded: (overlay === null || overlayIn) && (!searchAsked || searchIn),
  };
}

export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): Tools {
  return toolsToShow(overlay, overlaySettings, search).tools;
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch(before: SearchSettings, after: SearchSettings): boolean {
  return isSearching(before) !== isSearching(after);
}
