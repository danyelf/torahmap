// Build the per-square buffer from spatial items (identity-agnostic)

import type { Color } from '@torahmap/utils';
import type { SpatialItem, ItemColor } from './types.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

// Helper to check if color is an array of colors (a square split between them)
function isColorArray(color: ItemColor | null | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

// Fill for squares with no assigned color, e.g. the base layer before any
// overlay is picked. Shares its value with HIGHLIGHT_CONSTANTS.OUTLINE_COLOR,
// but that constant is named for its other use as a border color; this name
// says what it means here.
const DEFAULT_FILL_COLOR: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

/**
 * World units left empty at the right and bottom of every item's cell, so
 * neighbouring squares stand apart. Hit detection takes the whole cell, gap
 * included.
 */
export const SQUARE_GAP = 2;

// World units a square with several colors grows on every side, so it stands
// out from single-color squares when zoomed out. Up to half of SQUARE_GAP keeps
// a gap between neighbours. The shader applies it.
export const MULTICOLOR_GROWTH = 0.75;

// How far neighbouring color bands slide apart along their shared cut, as a
// fraction of the square's side. The shader applies it.
export const BAND_OFFSET = 0.08;

/**
 * One colouring of the map: a colour, or stripes, per square, and how far each
 * square has grown towards the size a multi-colour square is drawn at, 0 to 1.
 * Without `growth`, a square is fully grown exactly when its fill or its ring
 * has several colours. A square's ring, where `rings` gives one, surrounds its
 * fill in colours of its own. `uncoloured` marks the squares whose fill is
 * their default grey, which a hover paints in the highlight colour instead of
 * brightening. `standout` marks the squares drawn over all the others and never smaller than STANDOUT_MIN_PX.
 */
export interface Picture<C = ItemColor> {
  colors: C[];
  growth?: number[];
  rings?: (C | null)[];
  uncoloured?: boolean[];
  standout?: boolean[];
}

const NO_COLORS: Picture = { colors: [] };

/**
 * What the buffer holds for each square, read once per square. Each name is a
 * shader input, and rendering.ts points it at its slice.
 *
 * Each square carries two pictures, which the shader mixes by one fade for the
 * whole map, so moving between them redraws without rebuilding this buffer.
 * At rest the two are the same.
 *
 * A fill and a ring are four stripes each, one colour to a float (packColor):
 * unpacked, two pictures would need 19 attributes and 20 varyings, and WebGL 2
 * promises only 16 and 15.
 */
export const ITEM_ATTRIBUTES = [
  { name: 'a_rect', size: 4 }, // left, top, right, bottom in world units, before growing or jitter
  { name: 'a_jitter', size: 2 },
  { name: 'a_fill', size: 4 },
  { name: 'a_ring', size: 4 },
  { name: 'a_shape', size: 4 }, // fill stripe count, growth, ring stripe count (0 for none), flags (SHAPE_FLAGS)
  { name: 'a_nextFill', size: 4 },
  { name: 'a_nextRing', size: 4 },
  { name: 'a_nextShape', size: 4 },
] as const;

export type ItemAttributeName = (typeof ITEM_ATTRIBUTES)[number]['name'];

/** Where each entry starts within a square's slice, in floats. */
export const ITEM_OFFSETS = {} as Record<ItemAttributeName, number>;
let floats = 0;
for (const { name, size } of ITEM_ATTRIBUTES) {
  ITEM_OFFSETS[name] = floats;
  floats += size;
}
export const FLOATS_PER_ITEM = floats;

/** A colour as one float, 8 bits a channel; exact, as a float holds every integer below 2^24. */
export function packColor([r, g, b]: Color): number {
  const byte = (c: number): number => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return byte(r) * 0x10000 + byte(g) * 0x100 + byte(b);
}

/** The bits of a shape's last float. */
export const SHAPE_FLAGS = { UNCOLOURED: 1, STANDOUT: 2 } as const;

const SLOTS = {
  from: { fill: 'a_fill', ring: 'a_ring', shape: 'a_shape' },
  to: { fill: 'a_nextFill', ring: 'a_nextRing', shape: 'a_nextShape' },
} as const;

/** A square's stripes: at most four, and the base colour for none. */
function stripesOf(color: ItemColor | null | undefined, baseColor: Color): Color[] {
  if (isColorArray(color)) return color.slice(0, 4);
  if (Array.isArray(color) && (color as unknown[]).length === 0) return [baseColor];
  return [(color as Color | null | undefined) || baseColor];
}

export function buildItemGeometry<T>(
  items: SpatialItem<T>[],
  from: Picture = NO_COLORS,
  to: Picture = from,
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  const data = new Float32Array(items.length * FLOATS_PER_ITEM);

  const writePicture = (picture: Picture, slots: (typeof SLOTS)['from' | 'to'], i: number) => {
    const base = i * FLOATS_PER_ITEM;
    const fill = stripesOf(picture.colors[i], baseColor);
    const ringColor = picture.rings?.[i];
    const ring = ringColor ? stripesOf(ringColor, baseColor) : [];

    // Unused stripes stay zero
    fill.forEach((color, s) => (data[base + ITEM_OFFSETS[slots.fill] + s] = packColor(color)));
    ring.forEach((color, s) => (data[base + ITEM_OFFSETS[slots.ring] + s] = packColor(color)));
    const shape = base + ITEM_OFFSETS[slots.shape];
    data[shape] = fill.length;
    data[shape + 1] = picture.growth?.[i] ?? (Math.max(fill.length, ring.length) > 1 ? 1 : 0);
    data[shape + 2] = ring.length;
    data[shape + 3] =
      (picture.uncoloured?.[i] ? SHAPE_FLAGS.UNCOLOURED : 0) |
      (picture.standout?.[i] ? SHAPE_FLAGS.STANDOUT : 0);
  };

  for (let i = 0; i < items.length; i++) {
    const v = items[i];
    const rect = i * FLOATS_PER_ITEM + ITEM_OFFSETS.a_rect;
    data[rect] = v.x;
    data[rect + 1] = v.y;
    data[rect + 2] = v.x + v.size - SQUARE_GAP;
    data[rect + 3] = v.y + v.size - SQUARE_GAP;
    const jitter = i * FLOATS_PER_ITEM + ITEM_OFFSETS.a_jitter;
    data[jitter] = v.jitter?.x ?? 0;
    data[jitter + 1] = v.jitter?.y ?? 0;
    writePicture(from, SLOTS.from, i);
    writePicture(to, SLOTS.to, i);
  }

  return data;
}

export function createBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Failed to create buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}
