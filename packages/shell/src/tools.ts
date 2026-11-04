// The map shows an overlay and a search side by side, each on or off.
import type { Overlay, SettingsUpdate, ToolOnMap, Tools } from './overlays/types.ts';
import { settingsFromLink, settingsToLink, type LinkParams } from './overlays/settings.ts';
import type { SearchTool } from './app/search.ts';
import { dataFor, type Loaded } from './dataFiles.ts';

function withData<T>(tool: Overlay<T>, settings: unknown, loaded: Loaded): ToolOnMap<T> | null {
  const data = dataFor(tool, loaded);
  return data === null ? null : { tool, settings, data };
}

/** Whether a change turns the search on or off, a step Back can undo, rather than edits it. */
function togglesSearch<T, S>(search: SearchTool<T, S>, before: S, after: S): boolean {
  return search.isSearching(before) !== search.isSearching(after);
}

/** A text's tools: its search, and its overlays by id. */
export interface TextTools<T, S = unknown> {
  search: SearchTool<T, S>;
  overlay(id: string): Overlay<T> | undefined;
}

/**
 * Which overlay is on and the settings of both tools. Every overlay the reader has touched keeps
 * its settings, so switching away and back finds what was left; one with no entry has its
 * defaults. A value is frozen once built, settings included, and changes by making a new one.
 */
export interface ToolState<S> {
  readonly active: string | null;
  readonly overlays: ReadonlyMap<string, unknown>;
  readonly search: S;
}

/** What a link or a story stop names of the tools. */
interface LinkedTools {
  overlay?: string | null;
  overlayParams?: LinkParams;
  searchParams?: LinkParams;
}

/** What a link carries of the tools, with values at their default left out. */
interface ToolsLink {
  overlay?: string;
  overlayParams: Record<string, string>;
  searchParams: Record<string, string>;
}

export function emptyTools<T, S>(search: SearchTool<T, S>): ToolState<S> {
  return built({ active: null, overlays: new Map(), search: settingsFromLink(search, {}) });
}

/** The overlay `id` names, or null for none or an id the text doesn't have. */
export function overlayNamed<T, S>(
  tools: TextTools<T, S>,
  id: string | null | undefined,
): Overlay<T> | null {
  return (id && tools.overlay(id)) || null;
}

export function activeOverlay<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
): Overlay<T> | null {
  return overlayNamed(tools, state.active);
}

/**
 * The settings `state` holds for `overlay`, on or not; for one never touched, new defaults each
 * call.
 */
export function settingsIn<T, U>(state: ToolState<unknown>, overlay: Overlay<T, U>): U {
  return state.overlays.has(overlay.id)
    ? (state.overlays.get(overlay.id) as U)
    : settingsFromLink(overlay, {});
}

/** The overlay and the search, each with its data; null while off or waiting for its files. */
export function shownTools<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
  loaded: Loaded,
): Tools<T> {
  const overlay = activeOverlay(state, tools);
  const { search } = tools;
  return {
    overlay: overlay && withData(overlay, settingsIn(state, overlay), loaded),
    search: search.isSearching(state.search) ? withData(search, state.search, loaded) : null,
  };
}

/** The overlay, if one is on, and the search, while it searches on something; files or not. */
export function pickedTools<T, S>(state: ToolState<S>, tools: TextTools<T, S>): Overlay<T>[] {
  const overlay = activeOverlay(state, tools);
  return [
    ...(overlay ? [overlay] : []),
    ...(tools.search.isSearching(state.search) ? [tools.search] : []),
  ];
}

/** Make `id` the overlay, or none for an id the text lacks. Every overlay keeps its settings. */
export function withActive<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
  id: string,
): ToolState<S> {
  const overlay = overlayNamed(tools, id);
  if (!overlay) return state.active === null ? state : built({ ...state, active: null });
  if (overlay.id === state.active) return state;
  // An overlay that is on holds its settings, so they keep one identity while it stays on.
  const overlays = state.overlays.has(overlay.id)
    ? state.overlays
    : withEntry(state.overlays, overlay.id, settingsIn(state, overlay));
  return built({ ...state, active: overlay.id, overlays });
}

/** A change to `overlay`'s settings, which keeps out of the search's colours. */
export function withOverlaySettings<T, S, U>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
  overlay: Overlay<T, U>,
  update: SettingsUpdate<U>,
): ToolState<S> {
  const next = update(settingsIn(state, overlay), searchColors(state.search, tools));
  return built({ ...state, overlays: withEntry(state.overlays, overlay.id, next) });
}

/** A change to the search, which keeps out of the overlay's colours. */
export function withSearch<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
  update: SettingsUpdate<S>,
): ToolState<S> {
  return built({ ...state, search: update(state.search, overlayColors(state, tools)) });
}

/** `overlay` at its defaults, chosen to avoid the search's colours. */
export function withReset<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
  overlay: Overlay<T>,
): ToolState<S> {
  const next = settingsFromLink(overlay, {}, searchColors(state.search, tools));
  return built({ ...state, overlays: withEntry(state.overlays, overlay.id, next) });
}

/**
 * A link laid over `base`: the search's settings first, then the named overlay's, chosen to avoid
 * the search's colours. A link that names no overlay turns it off; every other overlay keeps what
 * `base` held.
 */
export function fromLink<T, S>(
  link: LinkedTools,
  base: ToolState<S>,
  tools: TextTools<T, S>,
): ToolState<S> {
  const search = settingsFromLink(tools.search, link.searchParams ?? {});
  const overlay = overlayNamed(tools, link.overlay);
  if (!overlay) return built({ ...base, active: null, search });
  const settings = settingsFromLink(overlay, link.overlayParams ?? {}, searchColors(search, tools));
  return built({
    active: overlay.id,
    overlays: withEntry(base.overlays, overlay.id, settings),
    search,
  });
}

/** What a change to the tools touched. */
interface ToolsChange {
  /** A different overlay is on, or none is. */
  switched: boolean;
  /** The overlay that stayed on has new settings. */
  settings: boolean;
  search: boolean;
  /** The overlay switched or the search turned on or off: a step Back can undo. */
  step: boolean;
}

export function toolsChange<T, S>(
  before: ToolState<S>,
  after: ToolState<S>,
  tools: TextTools<T, S>,
): ToolsChange {
  const switched = before.active !== after.active;
  const { active } = after;
  return {
    switched,
    // The overlay that is on always has an entry, so its settings compare by identity.
    settings:
      !switched && active !== null && before.overlays.get(active) !== after.overlays.get(active),
    search: before.search !== after.search,
    step: switched || togglesSearch(tools.search, before.search, after.search),
  };
}

/** The tools as a link carries them. */
export function toLink<T, S>(state: ToolState<S>, tools: TextTools<T, S>): ToolsLink {
  const overlay = activeOverlay(state, tools);
  return {
    ...(overlay && { overlay: overlay.id }),
    overlayParams: overlay ? settingsToLink(overlay, settingsIn(state, overlay)) : {},
    searchParams: settingsToLink(tools.search, state.search),
  };
}

/**
 * Keep of the overlay only what a link carries. The search stays as it is: a link doesn't record
 * which word has which colour, so passing the search through one could swap them.
 */
export function withOverlayTrimmed<T, S>(
  state: ToolState<S>,
  tools: TextTools<T, S>,
): ToolState<S> {
  const overlay = activeOverlay(state, tools);
  if (!overlay) return state;
  const linked = settingsToLink(overlay, settingsIn(state, overlay));
  const next = settingsFromLink(overlay, linked, searchColors(state.search, tools));
  return built({ ...state, overlays: withEntry(state.overlays, overlay.id, next) });
}

function searchColors<T, S>(search: S, tools: TextTools<T, S>): readonly number[] {
  return tools.search.colorsInUse?.(search) ?? [];
}

function overlayColors<T, S>(state: ToolState<S>, tools: TextTools<T, S>): readonly number[] {
  const overlay = activeOverlay(state, tools);
  return (overlay && overlay.colorsInUse?.(settingsIn(state, overlay))) ?? [];
}

function withEntry(
  map: ReadonlyMap<string, unknown>,
  id: string,
  settings: unknown,
): ReadonlyMap<string, unknown> {
  return new Map(map).set(id, settings);
}

// Freezing makes an update that edits settings in place throw, rather than change a value the
// story's picture cache has already drawn. It reaches plain objects and arrays only: a Map or Set,
// the value's own map included, is read-only by type alone.
function built<S>(state: ToolState<S>): ToolState<S> {
  state.overlays.forEach(deepFreeze);
  deepFreeze(state.search);
  return Object.freeze(state);
}

function deepFreeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
}
