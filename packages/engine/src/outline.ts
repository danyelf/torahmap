// Build outline geometry for square highlighting

import { HIGHLIGHT_CONSTANTS } from './constants.ts';
import { SQUARE_GAP } from './geometry.ts';
import type { MapItem } from './types.ts';

export type OutlineBounds = Pick<MapItem, 'x' | 'y' | 'size' | 'width' | 'jitter'>;

/** Build outline geometry as 4 border rectangles (24 corners, x and y each) around a square. */
export function buildOutlineGeometry(
  bounds: OutlineBounds,
  thickness: number = HIGHLIGHT_CONSTANTS.OUTLINE_THICKNESS,
): Float32Array {
  const verticesPerBorder = 6; // 2 triangles
  const borderCount = 4; // top, right, bottom, left
  const data = new Float32Array(borderCount * verticesPerBorder * 2);

  // Calculate outline bounds - extend OUTSIDE the square by thickness
  // so the outline doesn't cover the square itself
  const left = bounds.x + (bounds.jitter?.x ?? 0);
  const top = bounds.y + (bounds.jitter?.y ?? 0);
  const x0 = left - thickness;
  const y0 = top - thickness;
  const x1 = left + (bounds.width ?? bounds.size) - SQUARE_GAP + thickness;
  const y1 = top + bounds.size - SQUARE_GAP + thickness;

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
