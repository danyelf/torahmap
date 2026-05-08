// src/scrollytelling/colorBlending.ts
import { lerpColor } from './interpolation';

type Color = { r: number; g: number; b: number };

/**
 * Blend two arrays of (single-or-multi) verse colors slot-by-slot.
 *
 * Multi-color stipple is preserved through the transition: each slot lerps
 * independently. When one side has fewer slots than the other, the shorter
 * side is padded with the default color so missing stipple slots fade in/out
 * cleanly from the unmatched-verse fallback.
 *
 * If a verse ends up with a single slot, the result is returned as a plain
 * Color (not [Color]) so the geometry buffer emits it the same way it would
 * at rest.
 */
export function blendColorArrays(
  from: (Color | Color[])[],
  to: (Color | Color[])[],
  t: number
): (Color | Color[])[] {
  const len = Math.max(from.length, to.length);
  const result: (Color | Color[])[] = new Array(len);
  const defaultColor: Color = { r: 0.15, g: 0.15, b: 0.15 };

  for (let i = 0; i < len; i++) {
    const fromArr = toColorArray(i < from.length ? from[i] : undefined);
    const toArr = toColorArray(i < to.length ? to[i] : undefined);
    const maxLen = Math.max(fromArr.length, toArr.length, 1);

    const blendedSlots: Color[] = new Array(maxLen);
    for (let j = 0; j < maxLen; j++) {
      const a = j < fromArr.length ? fromArr[j] : defaultColor;
      const b = j < toArr.length ? toArr[j] : defaultColor;
      blendedSlots[j] = lerpColor(a, b, t);
    }

    result[i] = maxLen === 1 ? blendedSlots[0] : blendedSlots;
  }

  return result;
}

/**
 * Coerce a Color | Color[] | undefined into a Color[] for slot-wise iteration.
 * A single Color becomes a one-element array; undefined becomes empty.
 */
function toColorArray(c: Color | Color[] | undefined): Color[] {
  if (c === undefined) return [];
  if (Array.isArray(c)) return c;
  return [c];
}
