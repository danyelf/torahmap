// Build vertex buffer from spatial items (identity-agnostic)

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

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  colors?: (Color | Color[])[],
  baseColor: Color = DEFAULT_FILL_COLOR,
): Float32Array {
  // Each verse = 2 triangles = 6 vertices
  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const floatsPerVertex = 19;
  const verticesPerQuad = 6;
  const data = new Float32Array(verses.length * verticesPerQuad * floatsPerVertex);

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

    const x0 = v.x;
    const y0 = v.y;
    const x1 = v.x + v.size - 2; // -2 for gap
    const y1 = v.y + v.size - 2;

    // Verse world position seeds the shader's per-verse dithering noise
    const seedX = v.x;
    const seedY = v.y;

    // Pad to 4 colors with black
    while (vertexColors.length < 4) {
      vertexColors.push([0, 0, 0]);
    }

    const writeVertex = (x: number, y: number, u: number, vCoord: number) => {
      data[offset++] = x;
      data[offset++] = y;
      for (let c = 0; c < 4; c++) {
        data[offset++] = vertexColors[c][0];
        data[offset++] = vertexColors[c][1];
        data[offset++] = vertexColors[c][2];
      }
      data[offset++] = colorCount;
      data[offset++] = u;
      data[offset++] = vCoord;
      data[offset++] = seedX;
      data[offset++] = seedY;
    };

    // Triangle 1 (top-left, top-right, bottom-left)
    writeVertex(x0, y0, 0, 0);
    writeVertex(x1, y0, 1, 0);
    writeVertex(x0, y1, 0, 1);

    // Triangle 2 (bottom-left, top-right, bottom-right)
    writeVertex(x0, y1, 0, 1);
    writeVertex(x1, y0, 1, 0);
    writeVertex(x1, y1, 1, 1);
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
