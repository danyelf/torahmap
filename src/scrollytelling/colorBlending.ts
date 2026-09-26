import type { Color } from '../overlays/types.ts';
import { lerpColor } from './interpolation';

/**
 * A colour per verse, and how far each verse has grown towards the size a
 * multi-colour verse is drawn at: 0 is a plain square, 1 fully grown. Without
 * `growth`, a verse is fully grown exactly when it has several colours.
 */
export interface ColorLayer<C = Color | Color[]> {
  colors: C[];
  growth?: number[];
}

function growthAt(layer: ColorLayer, i: number, slots: number): number {
  return layer.growth?.[i] ?? (slots > 1 ? 1 : 0);
}

/**
 * Blend two arrays of (single-or-multi) verse colors slot-by-slot.
 *
 * Multi-color verses stay multi-color through the transition: each slot lerps
 * independently. The side with fewer slots is stretched to match, each of its
 * colours covering the slots nearest where its band lay, so a one-colour
 * square fades straight into the stripes it becomes rather than through dark
 * stripes. Its size eases from one to the other alongside.
 *
 * If a verse ends up with a single slot, the result is returned as a plain
 * Color (not [Color]) so the geometry buffer emits it the same way it would
 * at rest.
 */
export function blendColorArrays(from: ColorLayer, to: ColorLayer, t: number): ColorLayer {
  const len = Math.max(from.colors.length, to.colors.length);
  const colors: (Color | Color[])[] = new Array(len);
  const growth: number[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const fromArr = toColorArray(from.colors[i]);
    const toArr = toColorArray(to.colors[i]);
    const maxLen = Math.max(fromArr.length, toArr.length, 1);

    const blendedSlots: Color[] = new Array(maxLen);
    for (let j = 0; j < maxLen; j++) {
      blendedSlots[j] = lerpColor(stretched(fromArr, j, maxLen), stretched(toArr, j, maxLen), t);
    }

    colors[i] = maxLen === 1 ? blendedSlots[0] : blendedSlots;
    const grownFrom = growthAt(from, i, fromArr.length);
    const grownTo = growthAt(to, i, toArr.length);
    growth[i] = grownFrom + (grownTo - grownFrom) * t;
  }

  return { colors, growth };
}

const EMPTY_SLOT: Color = [0.15, 0.15, 0.15];

// The colour at slot `j` of `slots` spread over `count` equal bands.
function stretched(slots: Color[], j: number, count: number): Color {
  if (slots.length === 0) return EMPTY_SLOT;
  return slots[Math.floor((j * slots.length) / count)];
}

// A single Color is a 3-tuple of numbers; Color[] is an array of those tuples.
// Tell them apart by the type of the first element.
function toColorArray(c: Color | Color[] | undefined): Color[] {
  if (c === undefined) return [];
  return typeof c[0] === 'number' ? [c as Color] : (c as Color[]);
}
