// Camera module - handles zoom and pan state

import type { Bounds } from './types';

export interface Camera {
  x: number;     // pan x position
  y: number;     // pan y position
  zoom: number;  // zoom level (0.1 - 10.0)
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

// Margin from right edge to keep Genesis 1:1 clear of the sidebar (280px + padding)
const RIGHT_MARGIN = 320;
// Top margin to leave room for book labels above the first row
const TOP_MARGIN = 40;

/**
 * Create initial camera state with Genesis 1:1 near the top-right,
 * offset enough to clear the verse sidebar.
 * Always starts at 1.0 zoom to avoid moiré from fractional scaling.
 *
 * @param cssWidth - Window width in CSS pixels
 * @param cssHeight - Window height in CSS pixels
 * @param bounds - Bounding box of the visualization
 * @returns Camera state with 1.0 zoom, Genesis 1:1 at top-right
 */
export function createCamera(
  cssWidth: number,
  _cssHeight: number,
  bounds: Bounds
): Camera {
  // At zoom=1, screenX = (worldX + pan.x) * 1 = worldX + pan.x
  // Genesis 1:1 is near worldX ≈ bounds.width (rightmost after RTL mirror)
  // We want it at screenX = cssWidth - RIGHT_MARGIN
  // So pan.x = cssWidth - RIGHT_MARGIN - bounds.width
  return {
    x: cssWidth - RIGHT_MARGIN - bounds.width,
    y: TOP_MARGIN,
    zoom: 1.0,
  };
}

/**
 * Clamp zoom level to valid range [0.1, 10.0].
 *
 * @param zoom - Zoom value to clamp
 * @returns Clamped zoom value
 */
export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/**
 * Adjust pan to keep world point under mouse fixed during zoom.
 *
 * Formula:
 *   Before: worldX = mouseX / oldZoom - pan.x
 *   After:  worldX = mouseX / newZoom - newPan.x
 *   Solving: newPan.x = pan.x + mouseX * (1/newZoom - 1/oldZoom)
 *
 * @param pan - Current pan position
 * @param oldZoom - Zoom level before change
 * @param newZoom - Zoom level after change
 * @param mouseX - Mouse X position in screen coordinates
 * @param mouseY - Mouse Y position in screen coordinates
 * @returns New pan position
 */
export function panForZoom(
  pan: { x: number; y: number },
  oldZoom: number,
  newZoom: number,
  mouseX: number,
  mouseY: number
): { x: number; y: number } {
  return {
    x: pan.x + mouseX * (1 / newZoom - 1 / oldZoom),
    y: pan.y + mouseY * (1 / newZoom - 1 / oldZoom),
  };
}
