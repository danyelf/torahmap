import type { StoryStop } from '@torahmap/stories';
import type { ResolvedStoryStop } from './types';
import type { MapItem, VerseColor } from '../types';
import type { Overlay } from '../overlays/types.ts';
import type { Picture } from '../geometry.ts';
import { getOverlay } from '../overlays/registry';
import { fillDefaultColors, toolsPicture } from '../itemColoring';
import { still, type ColorLayer } from './colorBlending';
import { validateOverlayParams, type UrlParamValues } from '@torahmap/link';
import { NO_OVERLAY } from '@torahmap/overlay-catalog';
import { settingsFromLink } from '../overlays/settings.ts';
import type { SearchTool } from '../app/search.ts';
import { toolsPicked, toolsShown } from '../tools.ts';
import type { Loaded } from '../dataFiles.ts';

// Memoised per verses array and loaded files by the stop's overlay, its search and their
// validated link parameters. The key is canonical because validateOverlayParams
// writes keys in the order urlParams declares them, so stops that ask for the
// same thing share an entry. Colours that depend on the hover are recomputed
// while a verse is hovered: caching by hover too would add an entry for every
// verse the cursor crosses.
const picturesCache = new WeakMap<readonly MapItem[], WeakMap<Loaded, Map<string, Picture>>>();

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

function cacheKeyFor<T>(
  overlay: Overlay<T> | null,
  search: SearchTool<T>,
  stop: StoryStop,
): string {
  const overlayKey = overlay
    ? `${overlay.id}?${paramsKey(validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {}))}`
    : NO_OVERLAY;
  const searchKey = paramsKey(validateOverlayParams(search.urlParams, stop.searchParams ?? {}));
  return `${overlayKey}#${searchKey}`;
}

// Shortcut: a stop's overlay is the Tanakh's, whatever the text.
function overlayOf<T>(stop: StoryStop): Overlay<T> | null {
  return ((stop.overlay && getOverlay(stop.overlay)) || null) as Overlay<T> | null;
}

/** The tools a stop picks. */
export function stopTools<T>(stop: StoryStop, search: SearchTool<T>): Overlay<T>[] {
  return toolsPicked(overlayOf<T>(stop), search, settingsFromLink(search, stop.searchParams ?? {}));
}

export function pictureForStop<I extends MapItem>(
  stop: ResolvedStoryStop,
  verses: I[],
  hovered: I | null,
  loaded: Loaded,
  base: (index: number) => VerseColor,
  search: SearchTool<I>,
): Picture {
  const overlay = overlayOf<I>(stop);
  const byHover = !!(overlay?.hoverChangesColors && hovered);

  let byLoaded = picturesCache.get(verses);
  if (!byLoaded) {
    byLoaded = new WeakMap();
    picturesCache.set(verses, byLoaded);
  }
  let cache = byLoaded.get(loaded);
  if (!cache) {
    cache = new Map();
    byLoaded.set(loaded, cache);
  }
  const key = cacheKeyFor(overlay, search, stop);
  const cached = byHover ? undefined : cache.get(key);
  if (cached) return cached;

  const tools = toolsShown(
    overlay,
    overlay ? settingsFromLink(overlay, stop.overlayParams ?? {}) : undefined,
    search,
    settingsFromLink(search, stop.searchParams ?? {}),
    loaded,
  );
  const picture = fillDefaultColors(toolsPicture(tools, verses, hovered, base), base);
  if (!byHover) cache.set(key, picture);
  return picture;
}

// One stop's colours fading into the next's. At rest on a stop it is that
// stop's alone, and so is t === 1, which controller.ts hands over with two
// different stops when their rest zones touch.
export function computeBlendedColors<I extends MapItem>(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: I[],
  hovered: I | null,
  loaded: Loaded,
  base: (index: number) => VerseColor,
  search: SearchTool<I>,
): ColorLayer {
  if (fromStop === toStop || t === 0)
    return still(pictureForStop(fromStop, verses, hovered, loaded, base, search));
  if (t >= 1) return still(pictureForStop(toStop, verses, hovered, loaded, base, search));
  return {
    from: pictureForStop(fromStop, verses, hovered, loaded, base, search),
    to: pictureForStop(toStop, verses, hovered, loaded, base, search),
    t,
  };
}
