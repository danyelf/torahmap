import type { ResolvedStoryStop } from './types';
import type { TanakhLayout } from '../types';
import type { Color } from '../overlays/types.ts';
import type { Overlay } from '../overlays/types.ts';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../itemColoring';
import { blendColorArrays, type ColorLayer } from './colorBlending';
import { validateOverlayParams, type UrlParamValues } from '../urlState.ts';
import { settingsFromLink } from '../overlays/settings.ts';

// Memoised per verses array by overlay id and validated link parameters. The key is canonical
// because validateOverlayParams writes keys in the order urlParams declares them, so stops that
// ask for the same thing share an entry. Colours that depend on the hover are recomputed while a
// verse is hovered: caching by hover too would add an entry for every verse the cursor crosses.
const colorsCache = new WeakMap<TanakhLayout[], Map<string, (Color | Color[])[]>>();

// UrlParamValues declares every key optional; validateOverlayParams only ever
// sets present keys to non-empty strings, so this just gives TypeScript proof
// of what's already true at runtime.
function definedEntries(values: UrlParamValues): [string, string][] {
  return Object.entries(values).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
}

function cacheKeyFor(overlay: Overlay, params: UrlParamValues): string {
  const paramsKey = new URLSearchParams(Object.fromEntries(definedEntries(params))).toString();
  return `${overlay.id}?${paramsKey}`;
}

function withDefaults(colors: (Color | Color[] | null)[]): (Color | Color[])[] {
  return colors.map((c, i) => c ?? getDefaultColor(i));
}

export function colorsForStop(
  stop: ResolvedStoryStop,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): (Color | Color[])[] {
  const overlay = stop.overlay ? getOverlay(stop.overlay) : undefined;
  // No overlay, or one that doesn't answer as a function of settings: default
  // colours, the same as a stop with no overlay at all.
  if (!overlay || !overlay.colorsFor) {
    return verses.map((_, i) => getDefaultColor(i));
  }

  const raw = stop.overlayParams ?? {};
  if (overlay.hoverChangesColors && hovered) {
    return withDefaults(overlay.colorsFor(verses, settingsFromLink(overlay, raw), hovered));
  }

  let cache = colorsCache.get(verses);
  if (!cache) {
    cache = new Map();
    colorsCache.set(verses, cache);
  }
  const key = cacheKeyFor(overlay, validateOverlayParams(overlay.urlParams, raw));
  const cached = cache.get(key);
  if (cached) return cached;

  const resolved = withDefaults(overlay.colorsFor(verses, settingsFromLink(overlay, raw), hovered));
  cache.set(key, resolved);
  return resolved;
}

// At rest on a stop, which is where a timed ease captures its target, this is
// the stop's own colours, unblended. So is t === 1, which controller.ts hands
// over with two different stops when their rest zones touch.
export function computeBlendedColors(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): ColorLayer {
  if (fromStop === toStop || t === 0) return { colors: colorsForStop(fromStop, verses, hovered) };
  if (t >= 1) return { colors: colorsForStop(toStop, verses, hovered) };
  return blendColorArrays(
    { colors: colorsForStop(fromStop, verses, hovered) },
    { colors: colorsForStop(toStop, verses, hovered) },
    t,
  );
}
