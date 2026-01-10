// Build vertex buffer from verse layout

import type { Verse } from './types.ts';

type Color = [number, number, number];

// Helper to check if color is an array of colors (stipple mode)
function isColorArray(color: Color | Color[] | undefined): color is Color[] {
  return Array.isArray(color) && Array.isArray(color[0]);
}

export function buildVerseGeometry(
  verses: Verse[],
  baseColor: Color = [0.6, 0.6, 0.6]
): Float32Array {
  // Each verse = 2 triangles = 6 vertices
  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v
  const floatsPerVertex = 17;
  const verticesPerQuad = 6;
  const data = new Float32Array(verses.length * verticesPerQuad * floatsPerVertex);

  let offset = 0;
  for (const v of verses) {
    const x0 = v.x;
    const y0 = v.y;
    const x1 = v.x + v.size - 2; // -2 for 2px gap (more separation reduces moiré)
    const y1 = v.y + v.size - 2;

    // Extract colors - handle single color or array of colors
    let colors: Color[];
    if (isColorArray(v.color)) {
      colors = v.color.slice(0, 4) as Color[]; // Cap at 4 colors
    } else {
      colors = [v.color || baseColor];
    }
    const colorCount = colors.length;

    // Pad to 4 colors with black
    while (colors.length < 4) {
      colors.push([0, 0, 0]);
    }

    // Helper to write a vertex
    const writeVertex = (x: number, y: number, u: number, vCoord: number) => {
      data[offset++] = x;
      data[offset++] = y;
      // Write all 4 colors
      for (let c = 0; c < 4; c++) {
        data[offset++] = colors[c][0];
        data[offset++] = colors[c][1];
        data[offset++] = colors[c][2];
      }
      data[offset++] = colorCount;
      data[offset++] = u;
      data[offset++] = vCoord;
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
