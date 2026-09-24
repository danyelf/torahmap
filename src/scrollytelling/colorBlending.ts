import type { Color } from '../overlays/types.ts';
import { lerpColor } from './interpolation';

/**
 * Blend two arrays of (single-or-multi) verse colors slot-by-slot.
 *
 * Multi-color verses stay multi-color through the transition: each slot lerps
 * independently. When one side has fewer slots than the other, the shorter
 * side is padded with the default color so missing slots fade in/out
 * cleanly from the unmatched-verse fallback.
 *
 * If a verse ends up with a single slot, the result is returned as a plain
 * Color (not [Color]) so the geometry buffer emits it the same way it would
 * at rest.
 */
export function blendColorArrays(
  from: (Color | Color[])[],
  to: (Color | Color[])[],
  t: number,
): (Color | Color[])[] {
  const len = Math.max(from.length, to.length);
  const result: (Color | Color[])[] = new Array(len);
  const defaultColor: Color = [0.15, 0.15, 0.15];

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

// A single Color is a 3-tuple of numbers; Color[] is an array of those tuples.
// Tell them apart by the type of the first element.
function toColorArray(c: Color | Color[] | undefined): Color[] {
  if (c === undefined) return [];
  return typeof c[0] === 'number' ? [c as Color] : (c as Color[]);
}
