import {
  type MapItem,
  type ItemColor,
  type Picture,
  still,
  type ColorLayer,
} from '@torahmap/engine';
import type { StoryStop } from '@torahmap/stories';
import type { ResolvedStoryStop } from './types';
import { fillDefaultColors, toolsPicture } from '../itemColoring';
import { validateOverlayParams, type UrlParamValues } from '@torahmap/link';
import { NO_OVERLAY, type Overlay } from '../overlays/types.ts';
import type { Loaded } from '../dataFiles.ts';
import {
  activeOverlay,
  emptyTools,
  fromLink,
  overlayNamed,
  pickedTools,
  shownTools,
  type TextTools,
  type ToolState,
} from '../tools.ts';

// Memoised per items array and loaded files by the stop's tools value. Colours that
// depend on the hover are recomputed while a square is hovered: caching by
// hover too would add an entry for every square the cursor crosses.
const picturesCache = new WeakMap<
  readonly MapItem[],
  WeakMap<Loaded, WeakMap<ToolState<unknown>, Picture>>
>();

// UrlParamValues declares every key optional; validateOverlayParams only ever
// sets present keys to non-empty strings, so this just gives TypeScript proof
// of what's already true at runtime.
function definedEntries(values: UrlParamValues): [string, string][] {
  return Object.entries(values).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
}

function paramsKey(values: UrlParamValues): string {
  return new URLSearchParams(Object.fromEntries(definedEntries(values))).toString();
}

// Canonical because validateOverlayParams writes keys in the order urlParams
// declares them, so stops that ask for the same thing share a key.
function linkKey<T>(overlay: Overlay<T> | null, tools: TextTools<T>, stop: StoryStop): string {
  const overlayKey = overlay
    ? `${overlay.id}?${paramsKey(validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {}))}`
    : NO_OVERLAY;
  const searchKey = paramsKey(
    validateOverlayParams(tools.search.urlParams, stop.searchParams ?? {}),
  );
  return `${overlayKey}#${searchKey}`;
}

/** A text's tools, and the tools each story stop names as a value. */
export interface StoryTools<T> extends TextTools<T> {
  /**
   * Stops that name the same tools share one value, so they share its picture: stops that only
   * move the camera are common, and each would otherwise draw the same picture again.
   */
  toolsOf(stop: StoryStop): ToolState<unknown>;
}

export function createStoryTools<T>(tools: TextTools<T>): StoryTools<T> {
  const byStop = new WeakMap<StoryStop, ToolState<unknown>>();
  const byLink = new Map<string, ToolState<unknown>>();
  const empty = emptyTools(tools.search);
  return {
    ...tools,
    toolsOf(stop) {
      let state = byStop.get(stop);
      if (state) return state;
      const key = linkKey(overlayNamed(tools, stop.overlay), tools, stop);
      state = byLink.get(key);
      if (!state) {
        state = fromLink(stop, empty, tools);
        byLink.set(key, state);
      }
      byStop.set(stop, state);
      return state;
    },
  };
}

/** The tools a stop picks. */
export function stopTools<T>(stop: StoryStop, tools: StoryTools<T>): Overlay<T>[] {
  return pickedTools(tools.toolsOf(stop), tools);
}

export function pictureForStop<I extends MapItem>(
  stop: ResolvedStoryStop,
  items: I[],
  hovered: I | null,
  loaded: Loaded,
  base: (index: number) => ItemColor,
  tools: StoryTools<I>,
  keepsBase?: number,
): Picture {
  const state = tools.toolsOf(stop);
  const byHover = !!(activeOverlay(state, tools)?.hoverChangesColors && hovered);

  let byLoaded = picturesCache.get(items);
  if (!byLoaded) {
    byLoaded = new WeakMap();
    picturesCache.set(items, byLoaded);
  }
  let cache = byLoaded.get(loaded);
  if (!cache) {
    cache = new WeakMap();
    byLoaded.set(loaded, cache);
  }
  const cached = byHover ? undefined : cache.get(state);
  if (cached) return cached;

  const picture = fillDefaultColors(
    toolsPicture(
      shownTools(state, tools, loaded),
      items,
      { hovered, pinned: null },
      base,
      undefined,
      keepsBase,
    ),
    base,
  );
  if (!byHover) cache.set(state, picture);
  return picture;
}

// One stop's colours fading into the next's. At rest on a stop it is that
// stop's alone, and so is t === 1, which controller.ts hands over with two
// different stops when their rest zones touch.
export function computeBlendedColors<I extends MapItem>(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  items: I[],
  hovered: I | null,
  loaded: Loaded,
  base: (index: number) => ItemColor,
  tools: StoryTools<I>,
  keepsBase?: number,
): ColorLayer {
  if (fromStop === toStop || t === 0)
    return still(pictureForStop(fromStop, items, hovered, loaded, base, tools, keepsBase));
  if (t >= 1) return still(pictureForStop(toStop, items, hovered, loaded, base, tools, keepsBase));
  return {
    from: pictureForStop(fromStop, items, hovered, loaded, base, tools, keepsBase),
    to: pictureForStop(toStop, items, hovered, loaded, base, tools, keepsBase),
    t,
  };
}
