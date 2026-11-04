// The tools are the search and at most one overlay, held as one value (tools.ts).

import type { Loaded } from './dataFiles.ts';
import type { Overlay, SettingsUpdate, Tools } from './overlays/types.ts';
import { NO_OVERLAY } from './overlays/types.ts';
import {
  activeOverlay,
  emptyTools,
  fromLink,
  pickedTools,
  settingsIn,
  shownTools,
  toLink,
  withActive,
  withOverlaySettings,
  withOverlayTrimmed,
  withReset,
  withSearch,
  type LinkedTools,
  type TextTools,
  type ToolsLink,
} from './tools.ts';

export interface ToolsState<T, S> {
  /** The overlay that is on, if one is. */
  overlay(): Overlay<T> | null;
  /** Its id, or NO_OVERLAY. */
  overlayId(): string;
  searchSettings(): S;
  /** The settings held for `overlay`, on or not; for one never touched, new defaults each call. */
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
  /** Take the tools a link or a story stop names; other overlays keep their settings. */
  fromLink(link: LinkedTools): void;
  /** Keep of the overlay only what a link carries. False while no overlay is on. */
  keepOnlyLinked(): boolean;

  /** The tools as a link carries them. */
  toUrl(): ToolsLink;
}

export function createToolsState<T, S>(tools: TextTools<T, S>): ToolsState<T, S> {
  let state = emptyTools(tools.search);
  return {
    overlay: () => activeOverlay(state, tools),
    overlayId: () => state.active ?? NO_OVERLAY,
    searchSettings: () => state.search,
    settingsOf: (overlay) => settingsIn(state, overlay),
    shown: (loaded) => shownTools(state, tools, loaded),
    picked: () => pickedTools(state, tools),
    searching: () => tools.search.isSearching(state.search),

    switchTo(id) {
      state = withActive(state, tools, id);
    },

    reset(overlay) {
      state = withReset(state, tools, overlay);
    },

    changeOverlay(overlay, update) {
      state = withOverlaySettings(state, tools, overlay, update);
    },

    changeSearch(update) {
      const before = state.search;
      state = withSearch(state, tools, update);
      return { before, after: state.search };
    },

    fromLink(link) {
      state = fromLink(link, state, tools);
    },

    keepOnlyLinked() {
      if (state.active === null) return false;
      state = withOverlayTrimmed(state, tools);
      return true;
    },

    toUrl: () => toLink(state, tools),
  };
}
