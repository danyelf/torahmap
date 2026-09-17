import type { ResolvedStoryStop } from './types';
import type { TanakhLayout } from '../types';
import type { Color } from '../overlays/types.ts';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../itemColoring';
import { blendColorArrays } from './colorBlending';
import { applyOverlayParams } from '../overlays/applyParams';

function getColorsForStop(stop: ResolvedStoryStop, verses: TanakhLayout[]): (Color | Color[])[] {
  const overlay = stop.overlay ? getOverlay(stop.overlay) : undefined;
  if (!overlay) {
    return verses.map((_, i) => getDefaultColor(i));
  }

  // Apply overlay params through the one door: validated against the overlay's
  // own declaration, with URL writes off for the duration.
  if (stop.overlayParams) {
    applyOverlayParams(overlay, stop.overlayParams);
  }

  return verses.map((verse, i) => overlay.getVerseColor(verse) ?? getDefaultColor(i));
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
): (Color | Color[])[] {
  if (fromStop === toStop || t === 0) {
    return getColorsForStop(fromStop, verses);
  }
  if (t >= 1) {
    return getColorsForStop(toStop, verses);
  }

  return blendColorArrays(getColorsForStop(fromStop, verses), getColorsForStop(toStop, verses), t);
}
