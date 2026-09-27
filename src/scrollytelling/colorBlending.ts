import type { Color } from '../overlays/types.ts';
import type { Picture } from '../geometry.ts';
import { lerpColor } from './interpolation';

/** What the map shows: one picture, `t` of the way to fading into another. */
export interface ColorLayer<C = Color | Color[]> {
  from: Picture<C>;
  to?: Picture<C>;
  t: number;
}

export function still<C>(picture: Picture<C>): ColorLayer<C> {
  return { from: picture, t: 0 };
}

/** The layer as a single picture: what a new fade starts from. */
export function flatten(layer: ColorLayer): Picture {
  return layer.to ? mergePictures(layer.from, layer.to, layer.t) : layer.from;
}

function growthAt(picture: Picture, i: number, stripes: number): number {
  return picture.growth?.[i] ?? (stripes > 1 ? 1 : 0);
}

/**
 * One picture `t` of the way between two, blended stripe by stripe.
 *
 * The side with fewer stripes is stretched to match, each of its colours
 * covering the stripes nearest where its band lay. A verse whose stripe count
 * differs between the two therefore changes its stripe widths, which the
 * shader's fade between whole pictures avoids; this is only for collapsing a
 * fade in progress when another has to start from it. Rings merge the same
 * way, a verse without one counting its fill as its ring.
 *
 * If a verse ends up with a single slot, the result is returned as a plain
 * Color (not [Color]) so the geometry buffer emits it the same way it would
 * at rest.
 */
export function mergePictures(from: Picture, to: Picture, t: number): Picture {
  const len = Math.max(from.colors.length, to.colors.length);
  const colors: (Color | Color[])[] = new Array(len);
  const growth: number[] = new Array(len);
  const rings: (Color | Color[] | null)[] = new Array(len).fill(null);

  for (let i = 0; i < len; i++) {
    const fillFrom = toColorArray(from.colors[i]);
    const fillTo = toColorArray(to.colors[i]);
    colors[i] = mergeStripes(fillFrom, fillTo, t);

    const ringFrom = toColorArray(from.rings?.[i]);
    const ringTo = toColorArray(to.rings?.[i]);
    if (ringFrom.length > 0 || ringTo.length > 0) {
      rings[i] = mergeStripes(
        ringFrom.length > 0 ? ringFrom : fillFrom,
        ringTo.length > 0 ? ringTo : fillTo,
        t,
      );
    }

    const grownFrom = growthAt(from, i, Math.max(fillFrom.length, ringFrom.length));
    const grownTo = growthAt(to, i, Math.max(fillTo.length, ringTo.length));
    growth[i] = grownFrom + (grownTo - grownFrom) * t;
  }

  return from.rings || to.rings ? { colors, growth, rings } : { colors, growth };
}

function mergeStripes(from: Color[], to: Color[], t: number): Color | Color[] {
  const count = Math.max(from.length, to.length, 1);
  const stripes: Color[] = new Array(count);
  for (let j = 0; j < count; j++) {
    stripes[j] = lerpColor(stretched(from, j, count), stretched(to, j, count), t);
  }
  return count === 1 ? stripes[0] : stripes;
}

const EMPTY_SLOT: Color = [0.15, 0.15, 0.15];

// The colour at slot `j` of `slots` spread over `count` equal bands.
function stretched(slots: Color[], j: number, count: number): Color {
  if (slots.length === 0) return EMPTY_SLOT;
  return slots[Math.floor((j * slots.length) / count)];
}

// A single Color is a 3-tuple of numbers; Color[] is an array of those tuples.
// Tell them apart by the type of the first element.
function toColorArray(c: Color | Color[] | null | undefined): Color[] {
  if (!c) return [];
  return typeof c[0] === 'number' ? [c as Color] : (c as Color[]);
}
