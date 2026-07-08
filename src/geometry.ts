// Build vertex buffer from verse layout

import type { VerseLayout } from './types.ts';
import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

// Helper to check if color is an array of colors (stipple mode)
function isColorArray(color: Color | Color[] | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

export function buildVerseGeometry(
  verses: VerseLayout[],
  colors?: (Color | Color[])[],
  baseColor: Color = HIGHLIGHT_CONSTANTS.OUTLINE_COLOR
): Float32Array {
  // Each quad = 2 triangles = 6 vertices
  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const floatsPerVertex = 19;
  const verticesPerQuad = 6;

  // Count total quads: each verse contributes segments.length or 1 quad
  let totalQuads = 0;
  for (const v of verses) {
    totalQuads += v.segments ? v.segments.length : 1;
  }

  const data = new Float32Array(totalQuads * verticesPerQuad * floatsPerVertex);

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

    // Use verse world position as seed for unique stipple pattern
    // (consistent across all segments of the same verse)
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

    // Build list of rectangles to emit
    const rects = v.segments
      ? v.segments.map(s => ({ x: s.x, y: s.y, w: s.width, h: s.height }))
      : [{ x: v.x, y: v.y, w: v.size, h: v.size }];

    // Tooth extension: scroll segments (has segments) extend vertically into the gap
    // to create jagged text-like edges that break moiré patterns
    const hasSegments = !!v.segments;
    const toothExtend = (hasSegments && !isMulticolor) ? 1.05 : 0;

    for (const rect of rects) {
      // For multicolor verses, expand bounds to allow bleed
      const bleed = isMulticolor ? HIGHLIGHT_CONSTANTS.BLEED_PIXELS : 0;
      const innerW = rect.w - 2;
      const innerH = rect.h - 2;

      const x0 = rect.x - bleed;
      const y0 = rect.y - bleed - toothExtend;
      const x1 = rect.x + innerW + bleed; // -2 for gap, +bleed for expansion
      const y1 = rect.y + innerH + bleed + toothExtend;

      // UV coords: x accounts for bleed, y accounts for bleed + tooth extension
      const uvXMin = isMulticolor ? -bleed / innerW : 0;
      const uvXMax = isMulticolor ? 1 + bleed / innerW : 1;
      const uvYMin = -(bleed + toothExtend) / innerH;
      const uvYMax = 1 + (bleed + toothExtend) / innerH;

      // Triangle 1 (top-left, top-right, bottom-left)
      writeVertex(x0, y0, uvXMin, uvYMin);
      writeVertex(x1, y0, uvXMax, uvYMin);
      writeVertex(x0, y1, uvXMin, uvYMax);

      // Triangle 2 (bottom-left, top-right, bottom-right)
      writeVertex(x0, y1, uvXMin, uvYMax);
      writeVertex(x1, y0, uvXMax, uvYMin);
      writeVertex(x1, y1, uvXMax, uvYMax);
    }
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
