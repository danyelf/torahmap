// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, Tools } from './overlays/types.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';
import { isReady } from './dataLoading.ts';

/**
 * The tools a view shows: the overlay, if one is on, and the search, while it
 * has a word to search on. Neither shows until its data is in.
 */
export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): Tools {
  return {
    overlay: overlay && isReady(overlay) ? { tool: overlay, settings: overlaySettings } : null,
    search:
      isSearching(search) && isReady(searchTool) ? { tool: searchTool, settings: search } : null,
  };
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch(before: SearchSettings, after: SearchSettings): boolean {
  return isSearching(before) !== isSearching(after);
}
