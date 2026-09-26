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
 * What the buffer holds for each verse, in order. The GPU draws one square per
 * verse from it and reads each entry once per verse, not once per corner. The
 * shader declares an input per entry under the same name, and rendering.ts
 * points each at its slice, so a new per-verse value is a line here, a write in
 * buildItemGeometry, and its use in the shader.
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

export const FLOATS_PER_VERSE = VERSE_ATTRIBUTES.reduce((sum, a) => sum + a.size, 0);

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  colors?: (Color | Color[])[],
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  const data = new Float32Array(verses.length * FLOATS_PER_VERSE);

  let offset = 0;
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const verseColor = colors?.[i];

    let vertexColors: Color[];
    // Check for empty array first (before isColorArray which would fail on empty)
    if (Array.isArray(verseColor) && (verseColor as unknown[]).length === 0) {
      vertexColors = [baseColor];
    } else if (isColorArray(verseColor)) {
      vertexColors = verseColor.slice(0, 4) as Color[]; // Cap at 4 colors
    } else {
      vertexColors = [verseColor || baseColor];
    }
    const colorCount = vertexColors.length;

    const grow = colorCount > 1 ? MULTICOLOR_GROWTH : 0;
    data[offset++] = v.x - grow;
    data[offset++] = v.y - grow;
    data[offset++] = v.x + v.size - 2 + grow; // -2 for gap
    data[offset++] = v.y + v.size - 2 + grow;

    // Pad to 4 colors with black
    while (vertexColors.length < 4) {
      vertexColors.push([0, 0, 0]);
    }
    for (let c = 0; c < 4; c++) {
      data[offset++] = vertexColors[c][0];
      data[offset++] = vertexColors[c][1];
      data[offset++] = vertexColors[c][2];
    }
    data[offset++] = colorCount;
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
