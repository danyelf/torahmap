// Build outline geometry for verse highlighting

import { HIGHLIGHT_CONSTANTS } from './constants.ts';

export interface OutlineBounds {
  x: number;
  y: number;
  size: number;
}

/** Build outline geometry as 4 border rectangles (24 corners, x and y each) around a verse. */
export function buildOutlineGeometry(
  bounds: OutlineBounds,
  thickness: number = HIGHLIGHT_CONSTANTS.OUTLINE_THICKNESS,
): Float32Array {
  const verticesPerBorder = 6; // 2 triangles
  const borderCount = 4; // top, right, bottom, left
  const data = new Float32Array(borderCount * verticesPerBorder * 2);

  // Calculate outline bounds - extend OUTSIDE the verse by thickness
  // so the outline doesn't cover the verse itself
  const x0 = bounds.x - thickness;
  const y0 = bounds.y - thickness;
  const x1 = bounds.x + bounds.size - 2 + thickness; // -2 for gap, +thickness for outer edge
  const y1 = bounds.y + bounds.size - 2 + thickness;

  let offset = 0;

  const writeVertex = (x: number, y: number) => {
    data[offset++] = x;
    data[offset++] = y;
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
