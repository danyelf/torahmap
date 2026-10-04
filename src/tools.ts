// The map shows an overlay and a search side by side, each on or off.
import type { TanakhOverlay, TanakhTool, TanakhTools } from './overlays/index.ts';
import { isSearching, searchTool, type SearchSettings } from './overlays/search/index.ts';
import { dataFor, type Loaded } from './dataFiles.ts';

/** The tools a view picks: the overlay, if one is on, and the search, while it has a word to search on. */
export function toolsPicked(
  overlay: TanakhOverlay | null,
  search: SearchSettings,
): TanakhOverlay[] {
  return [...(overlay ? [overlay] : []), ...(isSearching(search) ? [searchTool] : [])];
}

/**
 * The tools a view shows: those it picks, each with its data, and left out
 * while a file it reads is missing.
 */
export function toolsShown(
  overlay: TanakhOverlay | null,
  overlaySettings: unknown,
  search: SearchSettings,
  loaded: Loaded,
): TanakhTools {
  return {
    overlay: overlay && withData(overlay, overlaySettings, loaded),
    search: isSearching(search) ? withData(searchTool, search, loaded) : null,
  };
}

function withData(tool: TanakhOverlay, settings: unknown, loaded: Loaded): TanakhTool | null {
  const data = dataFor(tool, loaded);
  return data === null ? null : { tool, settings, data };
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch(before: SearchSettings, after: SearchSettings): boolean {
  return isSearching(before) !== isSearching(after);
}
