// The tools are the search and at most one overlay. This holds them as one value (tools.ts) and
// keeps the one rule between them: a search word and an overlay pick are never in the same
// colour. It touches nothing on the page; the shell does what follows a change.

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
  /** Take the tools a link or a story stop names; other overlays keep their settings. */
  fromLink(link: LinkedTools): void;
  /** Keep of the overlay only what a link carries. False while no overlay is on. */
  keepOnlyLinked(): boolean;

  /** The tools as a link carries them. */
  toUrl(): ToolsLink;
}

export function createToolsState<T, S>(tools: TextTools<T, S>): ToolsState<T, S> {
  let state = emptyTools(tools.search);
  const overlay = () => activeOverlay(state, tools);

  return {
    overlay,
    overlayId: () => state.active ?? NO_OVERLAY,
    settingsOfOverlayOn: () => {
      const on = overlay();
      return on ? settingsIn(state, on) : undefined;
    },
    searchSettings: () => state.search,
    settingsOf: (of) => settingsIn(state, of),
    shown: (loaded) => shownTools(state, tools, loaded),
    picked: () => pickedTools(state, tools),
    searching: () => tools.search.isSearching(state.search),

    switchTo(id) {
      state = withActive(state, tools, id);
    },

    reset(of) {
      state = withReset(state, tools, of);
    },

    changeOverlay(of, update) {
      state = withOverlaySettings(state, tools, of, update);
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
