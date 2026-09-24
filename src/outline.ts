// Build outline geometry for verse highlighting

import { HIGHLIGHT_CONSTANTS } from './constants.ts';

type Color = [number, number, number];

export interface OutlineBounds {
  x: number;
  y: number;
  size: number;
}

// The defaults below are the only place either value is decided: callers that
// want the ordinary outline leave the field out rather than naming it again.
export interface OutlineOptions {
  thickness?: number;
  color?: Color;
}

/** Build outline geometry as 4 border rectangles (24 vertices) around a verse. */
export function buildOutlineGeometry(
  bounds: OutlineBounds,
  options: OutlineOptions = {},
): Float32Array {
  const thickness = options.thickness ?? HIGHLIGHT_CONSTANTS.OUTLINE_THICKNESS;
  const color = options.color ?? HIGHLIGHT_CONSTANTS.OUTLINE_COLOR;

  // Each vertex = x, y, r1,g1,b1, r2,g2,b2, r3,g3,b3, r4,g4,b4, colorCount, u, v, seedX, seedY
  const floatsPerVertex = 19;
  const verticesPerBorder = 6; // 2 triangles
  const borderCount = 4; // top, right, bottom, left
  const data = new Float32Array(borderCount * verticesPerBorder * floatsPerVertex);

  // Calculate outline bounds - extend OUTSIDE the verse by thickness
  // so the outline doesn't cover the verse itself
  const x0 = bounds.x - thickness;
  const y0 = bounds.y - thickness;
  const x1 = bounds.x + bounds.size - 2 + thickness; // -2 for gap, +thickness for outer edge
  const y1 = bounds.y + bounds.size - 2 + thickness;

  // Use verse position as seed for consistent pattern
  const seedX = bounds.x;
  const seedY = bounds.y;

  let offset = 0;

  const writeVertex = (x: number, y: number) => {
    data[offset++] = x;
    data[offset++] = y;
    // Write color to all 4 slots (single color mode)
    for (let c = 0; c < 4; c++) {
      data[offset++] = color[0];
      data[offset++] = color[1];
      data[offset++] = color[2];
    }
    data[offset++] = 1; // colorCount = 1 (single color)
    data[offset++] = 0; // u (not used for solid colors)
    data[offset++] = 0; // v (not used for solid colors)
    data[offset++] = seedX;
    data[offset++] = seedY;
  };

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
