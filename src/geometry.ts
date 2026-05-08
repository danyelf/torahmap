// Build vertex buffer from spatial items (identity-agnostic)

import type { SpatialItem } from './types.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

// Helper to check if color is an array of colors (stipple mode)
function isColorArray(color: Color | Color[] | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

export function buildItemGeometry<T>(
  verses: SpatialItem<T>[],
  colors?: (Color | Color[])[],
  baseColor: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR
): Float32Array {
  // Each verse = 2 triangles = 6 vertices
  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const floatsPerVertex = 19; // Added 2 for seed position
  const verticesPerQuad = 6;
  const data = new Float32Array(verses.length * verticesPerQuad * floatsPerVertex);

  let offset = 0;
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const verseColor = colors?.[i];

    // Extract colors - handle single color or array of colors
    let vertexColors: Color[];
    // Check for empty array first (before isColorArray which would fail on empty)
    if (Array.isArray(verseColor) && (verseColor as unknown[]).length === 0) {
      // Handle empty array - fall back to base color
      vertexColors = [baseColor];
    } else if (isColorArray(verseColor)) {
      vertexColors = verseColor.slice(0, 4) as Color[]; // Cap at 4 colors
    } else {
      vertexColors = [verseColor || baseColor];
    }
    const colorCount = vertexColors.length;
    const isMulticolor = colorCount > 1;

    // For multicolor verses, expand bounds to allow bleed
    const bleed = isMulticolor ? HIGHLIGHT_CONSTANTS.BLEED_PIXELS : 0;
    const x0 = v.x - bleed;
    const y0 = v.y - bleed;
    const x1 = v.x + v.size - 2 + bleed; // -2 for gap, +bleed for expansion
    const y1 = v.y + v.size - 2 + bleed;

    // UV coords need to account for bleed zone (-bleed to size+bleed maps to -epsilon to 1+epsilon)
    const uvMin = isMulticolor ? -bleed / (v.size - 2) : 0;
    const uvMax = isMulticolor ? 1 + bleed / (v.size - 2) : 1;

    // Use verse world position as seed for unique stipple pattern
    const seedX = v.x;
    const seedY = v.y;

    // Pad to 4 colors with black
    while (vertexColors.length < 4) {
      vertexColors.push([0, 0, 0]);
    }

    // Helper to write a vertex
    const writeVertex = (x: number, y: number, u: number, vCoord: number) => {
      data[offset++] = x;
      data[offset++] = y;
      // Write all 4 colors
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
    writeVertex(x0, y0, uvMin, uvMin);
    writeVertex(x1, y0, uvMax, uvMin);
    writeVertex(x0, y1, uvMin, uvMax);

    // Triangle 2 (bottom-left, top-right, bottom-right)
    writeVertex(x0, y1, uvMin, uvMax);
    writeVertex(x1, y0, uvMax, uvMin);
    writeVertex(x1, y1, uvMax, uvMax);
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
