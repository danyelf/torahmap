// Build the per-verse buffer from spatial items (identity-agnostic)

import type { SpatialItem } from './types.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

// Helper to check if color is an array of colors (a verse split between them)
function isColorArray(color: Color | Color[] | null | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

// Fill for verses with no assigned color, e.g. the base layer before any
// overlay is picked. Shares its value with HIGHLIGHT_CONSTANTS.OUTLINE_COLOR,
// but that constant is named for its other use as a border color; this name
// says what it means here.
const DEFAULT_FILL_COLOR: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

// World units a verse with several colors grows on every side, so it stands
// out from single-color verses when zoomed out. Squares sit 2 units apart, so
// up to 1 keeps a gap between neighbours. The shader applies it.
export const MULTICOLOR_GROWTH = 0.75;

/**
 * One colouring of the map: a colour, or stripes, per verse, and how far each
 * verse has grown towards the size a multi-colour verse is drawn at, 0 to 1.
 * Without `growth`, a verse is fully grown exactly when its fill or its ring
 * has several colours. A verse's ring, where `rings` gives one, surrounds its
 * fill in colours of its own.
 */
export interface Picture<C = Color | Color[]> {
  colors: C[];
  growth?: number[];
  rings?: (C | null)[];
}

const NO_COLORS: Picture = { colors: [] };

/**
 * What the buffer holds for each verse, read once per verse. Each name is a
 * shader input, and rendering.ts points it at its slice.
 *
 * Each verse carries two pictures, which the shader mixes by one fade for the
 * whole map, so moving between them redraws without rebuilding this buffer.
 * At rest the two are the same.
 *
 * A fill and a ring are four stripes each, one colour to a float (packColor):
 * unpacked, two pictures would need 19 attributes and 20 varyings, and WebGL 2
 * promises only 16 and 15.
 */
export const VERSE_ATTRIBUTES = [
  { name: 'a_rect', size: 4 }, // left, top, right, bottom in world units, before growing
  { name: 'a_fill', size: 4 },
  { name: 'a_ring', size: 4 },
  { name: 'a_shape', size: 3 }, // fill stripe count, growth, ring stripe count (0 for none)
  { name: 'a_nextFill', size: 4 },
  { name: 'a_nextRing', size: 4 },
  { name: 'a_nextShape', size: 3 },
] as const;

export type VerseAttributeName = (typeof VERSE_ATTRIBUTES)[number]['name'];

/** Where each entry starts within a verse's slice, in floats. */
export const VERSE_OFFSETS = {} as Record<VerseAttributeName, number>;
let floats = 0;
for (const { name, size } of VERSE_ATTRIBUTES) {
  VERSE_OFFSETS[name] = floats;
  floats += size;
}
export const FLOATS_PER_VERSE = floats;

/** A colour as one float, 8 bits a channel; exact, as a float holds every integer below 2^24. */
export function packColor([r, g, b]: Color): number {
  const byte = (c: number): number => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return byte(r) * 0x10000 + byte(g) * 0x100 + byte(b);
}

const SLOTS = {
  from: { fill: 'a_fill', ring: 'a_ring', shape: 'a_shape' },
  to: { fill: 'a_nextFill', ring: 'a_nextRing', shape: 'a_nextShape' },
} as const;

/** A verse's stripes: at most four, and the base colour for none. */
function stripesOf(color: Color | Color[] | null | undefined, baseColor: Color): Color[] {
  if (isColorArray(color)) return color.slice(0, 4);
  if (Array.isArray(color) && (color as unknown[]).length === 0) return [baseColor];
  return [(color as Color | null | undefined) || baseColor];
}

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  from: Picture = NO_COLORS,
  to: Picture = from,
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  const data = new Float32Array(verses.length * FLOATS_PER_VERSE);

  const writePicture = (picture: Picture, slots: (typeof SLOTS)['from' | 'to'], i: number) => {
    const base = i * FLOATS_PER_VERSE;
    const fill = stripesOf(picture.colors[i], baseColor);
    const ringColor = picture.rings?.[i];
    const ring = ringColor ? stripesOf(ringColor, baseColor) : [];

    // Unused stripes stay zero
    fill.forEach((color, s) => (data[base + VERSE_OFFSETS[slots.fill] + s] = packColor(color)));
    ring.forEach((color, s) => (data[base + VERSE_OFFSETS[slots.ring] + s] = packColor(color)));
    const shape = base + VERSE_OFFSETS[slots.shape];
    data[shape] = fill.length;
    data[shape + 1] = picture.growth?.[i] ?? (Math.max(fill.length, ring.length) > 1 ? 1 : 0);
    data[shape + 2] = ring.length;
  };

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const rect = i * FLOATS_PER_VERSE + VERSE_OFFSETS.a_rect;
    data[rect] = v.x;
    data[rect + 1] = v.y;
    data[rect + 2] = v.x + v.size - 2; // -2 for gap
    data[rect + 3] = v.y + v.size - 2;
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
