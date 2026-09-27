// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, Tools } from './overlays/types.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';

/**
 * The tools a view shows: the overlay, if one is on, and the search, while it
 * has a word to search on. The search is also still in the overlay list; as
 * the overlay, it shows through its own slot rather than twice.
 */
export function toolsShown(
  overlay: Overlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
): Tools {
  return {
    overlay:
      overlay && overlay !== searchTool ? { tool: overlay, settings: overlaySettings } : null,
    search: isSearching(search) ? { tool: searchTool, settings: search } : null,
  };
}
