// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, ToolOnMap, Tools } from './overlays/types.ts';
import type { SearchTool } from './app/search.ts';
import { dataFor, type Loaded } from './dataFiles.ts';

/** The tools a view picks: the overlay, if one is on, and the search, while it searches on something. */
export function toolsPicked<T, S>(
  overlay: Overlay<T> | null,
  search: SearchTool<T, S>,
  searchSettings: S,
): Overlay<T>[] {
  return [...(overlay ? [overlay] : []), ...(search.isSearching(searchSettings) ? [search] : [])];
}

/**
 * The tools a view shows: those it picks, each with its data, and left out
 * while a file it reads is missing.
 */
export function toolsShown<T, S>(
  overlay: Overlay<T> | null,
  overlaySettings: unknown,
  search: SearchTool<T, S>,
  searchSettings: S,
  loaded: Loaded,
): Tools<T> {
  return {
    overlay: overlay && withData(overlay, overlaySettings, loaded),
    search: search.isSearching(searchSettings) ? withData(search, searchSettings, loaded) : null,
  };
}

function withData<T>(tool: Overlay<T>, settings: unknown, loaded: Loaded): ToolOnMap<T> | null {
  const data = dataFor(tool, loaded);
  return data === null ? null : { tool, settings, data };
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
export function togglesSearch<T, S>(search: SearchTool<T, S>, before: S, after: S): boolean {
  return search.isSearching(before) !== search.isSearching(after);
}
