import type { ResolvedStoryStop } from './types';
import type { TanakhLayout } from '../types';
import type { Color } from '../overlays/types.ts';
import type { Overlay } from '../overlays/types.ts';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../itemColoring';
import { blendColorArrays } from './colorBlending';
import { validateOverlayParams, type UrlParamValues } from '../urlState.ts';

// Keyed on overlay id + the validated settings, so two stops that ask for the
// same thing share an entry and this module never has to know what a stop is
// called or how many exist. Settings are the only thing this caches by: an
// overlay whose colours depend on the hovered verse (only Haftarah — it's the
// one overlay that declares setHoveredVerse) is evaluated fresh, uncached,
// whenever a verse is actually hovered. Hit detection re-runs every frame the
// cursor is on the map, so caching by hover too would add one ~23,000-colour
// entry per frame and almost never reuse one.
const colorsCache = new Map<string, (Color | Color[])[]>();

// UrlParamValues declares every key optional; validateOverlayParams only ever
// sets present keys to non-empty strings, so this just gives TypeScript proof
// of what's already true at runtime.
function definedEntries(values: UrlParamValues): [string, string][] {
  return Object.entries(values).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
}

function cacheKeyFor(overlay: Overlay, settings: UrlParamValues): string {
  const settingsKey = new URLSearchParams(Object.fromEntries(definedEntries(settings))).toString();
  return `${overlay.id}?${settingsKey}`;
}

function getColorsForStop(
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

  const settings = validateOverlayParams(overlay.urlParams, stop.overlayParams ?? {});

  if (overlay.setHoveredVerse && hovered) {
    const colors = overlay.colorsFor(verses, settings, hovered);
    return colors.map((c, i) => c ?? getDefaultColor(i));
  }

  const key = cacheKeyFor(overlay, settings);
  const cached = colorsCache.get(key);
  if (cached) return cached;

  const colors = overlay.colorsFor(verses, settings, hovered);
  const resolved = colors.map((c, i) => c ?? getDefaultColor(i));
  colorsCache.set(key, resolved);
  return resolved;
}

// Stipple multi-color arrays are preserved at rest and during transitions:
// each stipple slot lerps independently, and the short side pads with the
// default color so slots fade in/out cleanly.
//
// main.ts only calls this mid-transition, where 0 < t < 1, so the t === 0 and
// t >= 1 branches below are a guard rather than a path it takes: a zero-width
// gap between two stops' rest zones (pathologically short stop heights) makes
// controller.ts hand this t === 1 without fromStop === toStop, so the guard
// stays rather than being deleted.
export function computeBlendedColors(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: TanakhLayout[],
  hovered: TanakhLayout | null,
): (Color | Color[])[] {
  if (fromStop === toStop || t === 0) {
    return getColorsForStop(fromStop, verses, hovered);
  }
  if (t >= 1) {
    return getColorsForStop(toStop, verses, hovered);
  }

  return blendColorArrays(
    getColorsForStop(fromStop, verses, hovered),
    getColorsForStop(toStop, verses, hovered),
    t,
  );
}
