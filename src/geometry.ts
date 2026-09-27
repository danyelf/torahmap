// Build the per-verse buffer from spatial items (identity-agnostic)

import type { SpatialItem } from './types.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

// Helper to check if color is an array of colors (a verse split between them)
function isColorArray(color: Color | Color[] | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

// Fill for verses with no assigned color, e.g. the base layer before any
// overlay is picked. Shares its value with HIGHLIGHT_CONSTANTS.OUTLINE_COLOR,
// but that constant is named for its other use as a border color; this name
// says what it means here.
const DEFAULT_FILL_COLOR: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

// World units a verse with several colors grows on every side, so it stands
// out from single-color verses when zoomed out. Squares sit 2 units apart, so
// up to 1 keeps a gap between neighbours.
const MULTICOLOR_GROWTH = 0.75;

/**
 * What the buffer holds for each verse, read once per verse. Each name is a
 * shader input, and rendering.ts points it at its slice.
 */
export const VERSE_ATTRIBUTES = [
  { name: 'a_rect', size: 4 }, // left, top, right, bottom in world units
  { name: 'a_color', size: 3 },
  { name: 'a_color2', size: 3 },
  { name: 'a_color3', size: 3 },
  { name: 'a_color4', size: 3 },
  { name: 'a_colorCount', size: 1 },
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

const COLOR_SLOTS = ['a_color', 'a_color2', 'a_color3', 'a_color4'] as const;

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  colors?: (Color | Color[])[],
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  const data = new Float32Array(verses.length * FLOATS_PER_VERSE);

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const verseColor = colors?.[i];
    const base = i * FLOATS_PER_VERSE;

    let verseColors: Color[];
    // Check for empty array first (before isColorArray which would fail on empty)
    if (Array.isArray(verseColor) && (verseColor as unknown[]).length === 0) {
      verseColors = [baseColor];
    } else if (isColorArray(verseColor)) {
      verseColors = verseColor.slice(0, 4) as Color[]; // Cap at 4 colors
    } else {
      verseColors = [verseColor || baseColor];
    }
    const colorCount = verseColors.length;

    const grow = colorCount > 1 ? MULTICOLOR_GROWTH : 0;
    const rect = base + VERSE_OFFSETS.a_rect;
    data[rect] = v.x - grow;
    data[rect + 1] = v.y - grow;
    data[rect + 2] = v.x + v.size - 2 + grow; // -2 for gap
    data[rect + 3] = v.y + v.size - 2 + grow;
    // Unused colour slots stay zero
    for (let c = 0; c < colorCount; c++) {
      data.set(verseColors[c], base + VERSE_OFFSETS[COLOR_SLOTS[c]]);
    }
    data[base + VERSE_OFFSETS.a_colorCount] = colorCount;
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
