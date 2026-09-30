// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, Tools } from './overlays/types.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';
import { isReady } from './dataLoading.ts';

/** The tools a view asks for: the overlay, if one is on, and the search, while it has a word to search on. */
function toolsAsked(overlay: Overlay | null, search: SearchSettings) {
  return { overlay, search: isSearching(search) ? searchTool : null };
}

/** The tools a view shows: those it asks for whose data is in. */
export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): Tools {
  const asked = toolsAsked(overlay, search);
  return {
    overlay:
      asked.overlay && isReady(asked.overlay)
        ? { tool: asked.overlay, settings: overlaySettings }
        : null,
    search: asked.search && isReady(asked.search) ? { tool: asked.search, settings: search } : null,
  };
}

/** Whether a view shows every tool it asks for, none left out for want of its data. */
export function toolsLoaded(overlay: Overlay | null, search: SearchSettings): boolean {
  return Object.values(toolsAsked(overlay, search)).every((tool) => !tool || isReady(tool));
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch(before: SearchSettings, after: SearchSettings): boolean {
  return isSearching(before) !== isSearching(after);
}
