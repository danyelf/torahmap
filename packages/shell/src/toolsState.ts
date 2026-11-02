// The tools are the search and at most one overlay. This holds which overlay is on and every
// tool's settings, and keeps the one rule between them: a search word and an overlay pick are
// never in the same colour. It touches nothing on the page; the shell does what follows a change.

import type { SearchTool } from './app/search.ts';
import type { Loaded } from './dataFiles.ts';
import { createOverlaySettings, type LinkParams } from './overlays/settings.ts';
import type { Overlay, SettingsUpdate, Tools } from './overlays/types.ts';
import { NO_OVERLAY } from './overlays/types.ts';
import { toolsPicked, toolsShown } from './tools.ts';

/** What a link carries of the tools. */
// Not UrlState's own: its search parameters may hold undefined, which settings never write.
export interface ToolsLink {
  overlay?: string;
  overlayParams: Record<string, string>;
  searchParams: Record<string, string>;
}

export interface ToolsState<T, S> {
  /** The overlay that is on, if one is. */
  overlay(): Overlay<T> | null;
  /** Its id, or NO_OVERLAY. */
  overlayId(): string;
  /** The on overlay's settings; undefined while none is on. */
  settingsOfOverlayOn(): unknown;
  searchSettings(): S;
  /** The settings held for `overlay`, on or not. */
  settingsOf<U>(overlay: Overlay<T, U>): U;
  /** The overlay and the search as they stand, each null while off or waiting for its files. */
  shown(loaded: Loaded): Tools<T>;
  /** The overlay and the search as picked, whether or not their files are in. */
  picked(): Overlay<T>[];
  searching(): boolean;

  /** Make `id` the overlay, or none for an id nothing has. Every overlay keeps its settings. */
  switchTo(id: string): void;
  /** Give `overlay` its default settings, chosen to avoid the search's colours. */
  reset(overlay: Overlay<T>): void;
  /** A reader's edit to `overlay`'s settings, which keeps out of the search's colours. */
  changeOverlay<U>(overlay: Overlay<T, U>, update: SettingsUpdate<U>): void;
  /** A reader's edit to the search, which keeps out of the overlay's colours. */
  changeSearch(update: SettingsUpdate<S>): { before: S; after: S };
  /** Replace both tools' settings with a link's or a story stop's; the search goes first. */
  restore(overlayParams: LinkParams, searchParams: LinkParams): void;
  /** Keep of the overlay only what a link carries. False while no overlay is on. */
  keepOnlyLinked(): boolean;

  /** The tools as a link carries them. */
  toUrl(): ToolsLink;
}

export function createToolsState<T, S>(
  search: SearchTool<T, S>,
  getOverlay: (id: string) => Overlay<T> | undefined,
): ToolsState<T, S> {
  let current: Overlay<T> | null = null;
  const settings = createOverlaySettings();

  const searchColors = (): readonly number[] => search.colorsInUse?.(settings.get(search)) ?? [];
  const overlayColors = (): readonly number[] =>
    current?.colorsInUse?.(settings.get(current)) ?? [];

  return {
    overlay: () => current,
    overlayId: () => current?.id ?? NO_OVERLAY,
    settingsOfOverlayOn: () => (current ? settings.get(current) : undefined),
    searchSettings: () => settings.get(search),
    settingsOf: (overlay) => settings.get(overlay),
    shown: (loaded) =>
      toolsShown(
        current,
        current ? settings.get(current) : undefined,
        search,
        settings.get(search),
        loaded,
      ),
    picked: () => toolsPicked(current, search, settings.get(search)),
    searching: () => search.isSearching(settings.get(search)),

    switchTo(id) {
      current = getOverlay(id) ?? null;
    },

    reset(overlay) {
      settings.restore(overlay, {}, searchColors());
    },

    changeOverlay(overlay, update) {
      settings.set(overlay, update(settings.get(overlay), searchColors()));
    },

    changeSearch(update) {
      const before = settings.get(search);
      const after = update(before, overlayColors());
      settings.set(search, after);
      return { before, after };
    },

    restore(overlayParams, searchParams) {
      settings.restore(search, searchParams);
      if (current) settings.restore(current, overlayParams, searchColors());
    },

    keepOnlyLinked() {
      if (!current) return false;
      settings.restore(current, settings.toUrl(current), searchColors());
      return true;
    },

    toUrl() {
      return {
        ...(current && { overlay: current.id }),
        overlayParams: current ? settings.toUrl(current) : {},
        searchParams: settings.toUrl(search),
      };
    },
  };
}
