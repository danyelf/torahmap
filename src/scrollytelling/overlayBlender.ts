import type { ResolvedStoryStop } from './types';
import type { TanakhLayout } from '../types';
import { getOverlay } from '../overlays/registry';
import { getDefaultColor } from '../itemColoring';
import { blendColorArrays } from './colorBlending';
import { applyOverlayParams } from '../overlays/applyParams';

type Color = { r: number; g: number; b: number };

function tupleToObj(c: [number, number, number]): Color {
  return { r: c[0], g: c[1], b: c[2] };
}

function toObjColor(c: [number, number, number] | [number, number, number][]): Color | Color[] {
  if (c.length === 0) return { r: 0, g: 0, b: 0 };
  if (typeof c[0] === 'number') {
    return tupleToObj(c as [number, number, number]);
  }
  return (c as [number, number, number][]).map(tupleToObj);
}

function objToTuple(c: Color): [number, number, number] {
  return [c.r, c.g, c.b];
}

// Colors are handled as { r, g, b } objects here for blending compatibility.
function getColorsForStop(stop: ResolvedStoryStop, verses: TanakhLayout[]): (Color | Color[])[] {
  if (!stop.overlay) {
    return verses.map((_, i) => tupleToObj(getDefaultColor(i)));
  }

  const overlay = getOverlay(stop.overlay);
  if (!overlay) {
    return verses.map((_, i) => tupleToObj(getDefaultColor(i)));
  }

  // Apply overlay params through the one door: validated against the overlay's
  // own declaration, with URL writes off for the duration.
  if (stop.overlayParams) {
    applyOverlayParams(overlay, stop.overlayParams);
  }

  return verses.map((verse, i) => {
    const color = overlay.getVerseColor(verse);
    if (color === null) {
      return tupleToObj(getDefaultColor(i));
    }
    return toObjColor(color);
  });
}

// Stipple multi-color arrays are preserved at rest and during transitions:
// each stipple slot lerps independently, and the short side pads with the
// default color so slots fade in/out cleanly.
export function computeBlendedColors(
  fromStop: ResolvedStoryStop,
  toStop: ResolvedStoryStop,
  t: number,
  verses: TanakhLayout[],
): ([number, number, number] | [number, number, number][])[] {
  if (fromStop === toStop || t === 0) {
    return colorsToTuplesPreserveStipple(getColorsForStop(fromStop, verses));
  }
  if (t >= 1) {
    return colorsToTuplesPreserveStipple(getColorsForStop(toStop, verses));
  }

  const fromColors = getColorsForStop(fromStop, verses);
  const toColors = getColorsForStop(toStop, verses);

  const blended = blendColorArrays(fromColors, toColors, t);
  return colorsToTuplesPreserveStipple(blended);
}

// Multi-color verses remain as arrays so geometry.ts can render them as stipple.
function colorsToTuplesPreserveStipple(
  colors: (Color | Color[])[],
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
