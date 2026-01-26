// Build outline geometry for verse highlighting

import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

export interface OutlineBounds {
  x: number;
  y: number;
  size: number;
}

export interface OutlineOptions {
  thickness?: number;
  color?: Color;
}

/**
 * Build outline geometry as 4 border rectangles around a verse.
 * Each border is 2 triangles (6 vertices), total 24 vertices.
 *
 * @param bounds - Verse bounds (x, y, size)
 * @param options - Outline configuration (thickness, color)
 * @returns Float32Array with vertex data (24 vertices * 19 floats each)
 */
export function buildOutlineGeometry(
  bounds: OutlineBounds,
  options: OutlineOptions = {}
): Float32Array {
  const thickness = options.thickness ?? 2;
  const color = options.color ?? HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const floatsPerVertex = 19;
  const verticesPerBorder = 6; // 2 triangles
  const borderCount = 4; // top, right, bottom, left
  const data = new Float32Array(borderCount * verticesPerBorder * floatsPerVertex);

  // Calculate outline bounds (same as verse bounds with -2 gap adjustment)
  const x0 = bounds.x;
  const y0 = bounds.y;
  const x1 = bounds.x + bounds.size - 2; // -2 for gap
  const y1 = bounds.y + bounds.size - 2;

  // Use verse position as seed for consistent pattern
  const seedX = bounds.x;
  const seedY = bounds.y;

  let offset = 0;

  // Helper to write a vertex with single color (no stipple for outlines)
  const writeVertex = (x: number, y: number) => {
    data[offset++] = x;
    data[offset++] = y;
    // Write color to all 4 slots (single color mode)
    for (let c = 0; c < 4; c++) {
      data[offset++] = color[0];
      data[offset++] = color[1];
      data[offset++] = color[2];
    }
    data[offset++] = 1; // colorCount = 1 (single color, no stipple)
    data[offset++] = 0; // u (not used for solid colors)
    data[offset++] = 0; // v (not used for solid colors)
    data[offset++] = seedX;
    data[offset++] = seedY;
  };

  // Helper to write a rectangle as 2 triangles
  const writeRect = (rx0: number, ry0: number, rx1: number, ry1: number) => {
    // Triangle 1 (top-left, top-right, bottom-left)
    writeVertex(rx0, ry0);
    writeVertex(rx1, ry0);
    writeVertex(rx0, ry1);
    // Triangle 2 (bottom-left, top-right, bottom-right)
    writeVertex(rx0, ry1);
    writeVertex(rx1, ry0);
    writeVertex(rx1, ry1);
  };

  // Top border (horizontal rectangle across top)
  writeRect(x0, y0, x1, y0 + thickness);

  // Right border (vertical rectangle on right side)
  writeRect(x1 - thickness, y0, x1, y1);

  // Bottom border (horizontal rectangle across bottom)
  writeRect(x0, y1 - thickness, x1, y1);

  // Left border (vertical rectangle on left side)
  writeRect(x0, y0, x0 + thickness, y1);

  return data;
}
