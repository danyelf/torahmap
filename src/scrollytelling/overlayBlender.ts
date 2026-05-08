// src/scrollytelling/overlayBlender.ts
import type { ResolvedStoryStop } from './types';
import type { VerseLayout } from '../types';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../verseColoring';
import { blendColorArrays } from './colorBlending';

type Color = { r: number; g: number; b: number };

/**
 * Convert a tuple [r, g, b] to { r, g, b } object.
 */
function tupleToObj(c: [number, number, number]): Color {
  return { r: c[0], g: c[1], b: c[2] };
}

/**
 * Convert a tuple-or-tuple-array to Color-or-Color-array.
 */
function toObjColor(
  c: [number, number, number] | [number, number, number][]
): Color | Color[] {
  if (c.length === 0) return { r: 0, g: 0, b: 0 };
  if (typeof c[0] === 'number') {
    return tupleToObj(c as [number, number, number]);
  }
  return (c as [number, number, number][]).map(tupleToObj);
}

/**
 * Convert { r, g, b } object back to [r, g, b] tuple.
 */
function objToTuple(c: Color): [number, number, number] {
  return [c.r, c.g, c.b];
}

/**
 * Get colors for a single story stop by querying its overlay.
 * Returns colors as { r, g, b } objects for blending compatibility.
 */
export function getColorsForStop(
  stop: ResolvedStoryStop,
  verses: VerseLayout[]
): (Color | Color[])[] {
  if (!stop.overlay) {
    return verses.map((_, i) => tupleToObj(getDefaultColor(i)));
  }

  const overlay = getOverlay(stop.overlay);
  if (!overlay) {
    return verses.map((_, i) => tupleToObj(getDefaultColor(i)));
  }

  // Apply overlay params
  if (stop.overlayParams && overlay.applyUrlParams) {
    const params = new URLSearchParams(stop.overlayParams);
    overlay.applyUrlParams(params);
  }

  return verses.map((verse, i) => {
    const color = overlay.getVerseColor(verse);
    if (color === null) {
      return tupleToObj(getDefaultColor(i));
    }
    return toObjColor(color);
  });
}

/**
 * Compute blended colors for a scroll transition between two stops.
 * Stipple multi-color arrays are preserved at rest AND during in-progress
 * transitions: each stipple slot lerps independently, and short sides pad
 * with the default color so slots fade in/out cleanly.
 */
export function computeBlendedColors(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: VerseLayout[]
): ([number, number, number] | [number, number, number][])[] {
  // If same stop or at rest, return that stop's colors (no blend needed)
  // Preserve stipple arrays so multi-color verses render correctly.
  if (fromStop === toStop || t === 0) {
    return colorsToTuplesPreserveStipple(getColorsForStop(fromStop, verses));
  }
  if (t >= 1) {
    return colorsToTuplesPreserveStipple(getColorsForStop(toStop, verses));
  }

  const fromColors = getColorsForStop(fromStop, verses);
  const toColors = getColorsForStop(toStop, verses);

  // blendColorArrays now lerps slot-by-slot, preserving stipple arrays.
  const blended = blendColorArrays(fromColors, toColors, t);
  return colorsToTuplesPreserveStipple(blended);
}

/**
 * Convert an array of Color-or-Color[] objects to tuples, preserving stipple arrays.
 * Multi-color verses remain as arrays so geometry.ts can render them as stipple.
 */
function colorsToTuplesPreserveStipple(
  colors: (Color | Color[])[]
): ([number, number, number] | [number, number, number][])[] {
  return colors.map((c) => {
    if (Array.isArray(c)) {
      if (c.length === 0) return [0, 0, 0] as [number, number, number];
      if (c.length === 1) return objToTuple(c[0]);
      return c.map(objToTuple);
    }
    return objToTuple(c);
  });
}
