import type { ResolvedStoryStop, StoryStop } from './types';
import type { TanakhLayout } from '../types';
import type { Color, Overlay } from '../overlays/types.ts';
import type { Picture } from '../geometry.ts';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor, toolsPicture } from '../itemColoring';
import { still, type ColorLayer } from './colorBlending';
import { SEARCH_URL_PARAMS, validateOverlayParams, type UrlParamValues } from '../urlState.ts';
import { settingsFromLink } from '../overlays/settings.ts';
import { searchFromLink } from '../overlays/search/index.ts';
import { toolsShown } from '../tools.ts';

// Memoised per verses array by the stop's overlay, its search and their
// validated link parameters. The key is canonical because validateOverlayParams
// writes keys in the order urlParams declares them, so stops that ask for the
// same thing share an entry. Colours that depend on the hover are recomputed
// while a verse is hovered: caching by hover too would add an entry for every
// verse the cursor crosses.
const picturesCache = new WeakMap<TanakhLayout[], Map<string, Picture>>();

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

type StopTools = Pick<StoryStop, 'overlay' | 'overlayParams'>;

/** A stop's search. A stop searches by naming the search as its overlay. */
export function stopSearchParams(stop: StopTools): Record<string, string> {
  return stop.overlay === 'search' ? (stop.overlayParams ?? {}) : {};
}

function cacheKeyFor(overlay: Overlay | null, stop: StopTools): string {
  const overlayKey = overlay
    ? `${overlay.id}?${paramsKey(validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {}))}`
    : 'none';
  const searchKey = paramsKey(validateOverlayParams(SEARCH_URL_PARAMS, stopSearchParams(stop)));
  return `${overlayKey}#${searchKey}`;
}

function withDefaults(picture: Picture<Color | Color[] | null>): Picture {
  return { ...picture, colors: picture.colors.map((c, i) => c ?? getDefaultColor(i)) };
}

export function pictureForStop(
  stop: ResolvedStoryStop,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): Picture {
  const named = stop.overlay ? getOverlay(stop.overlay) : undefined;
  // One that doesn't answer as a function of settings is drawn as no overlay.
  const overlay = named?.colorsFor ? named : null;
  const byHover = !!(overlay?.hoverChangesColors && hovered);

  let cache = picturesCache.get(verses);
  if (!cache) {
    cache = new Map();
    picturesCache.set(verses, cache);
  }
  const key = cacheKeyFor(overlay, stop);
  const cached = byHover ? undefined : cache.get(key);
  if (cached) return cached;

  const tools = toolsShown(
    overlay,
    overlay ? settingsFromLink(overlay, stop.overlayParams ?? {}) : undefined,
    searchFromLink(stopSearchParams(stop)),
  );
  const picture = withDefaults(toolsPicture(tools, verses, hovered));
  if (!byHover) cache.set(key, picture);
  return picture;
}

// One stop's colours fading into the next's. At rest on a stop it is that
// stop's alone, and so is t === 1, which controller.ts hands over with two
// different stops when their rest zones touch.
export function computeBlendedColors(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): ColorLayer {
  if (fromStop === toStop || t === 0) return still(pictureForStop(fromStop, verses, hovered));
  if (t >= 1) return still(pictureForStop(toStop, verses, hovered));
  return {
    from: pictureForStop(fromStop, verses, hovered),
    to: pictureForStop(toStop, verses, hovered),
    t,
  };
}
