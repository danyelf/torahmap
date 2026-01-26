// Camera module - handles zoom and pan state

import type { Bounds } from './types';

export interface Camera {
  x: number;     // pan x position
  y: number;     // pan y position
  zoom: number;  // zoom level (0.1 - 10.0)
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

/**
 * Create initial camera state centered on the given bounds.
 * Always starts at 1.0 zoom to avoid moiré from fractional scaling.
 *
 * @param cssWidth - Window width in CSS pixels
 * @param cssHeight - Window height in CSS pixels
 * @param bounds - Bounding box of the visualization
 * @returns Camera state with 1.0 zoom, centered on bounds
 */
export function createCamera(
  cssWidth: number,
  cssHeight: number,
  bounds: Bounds
): Camera {
  return {
    x: cssWidth / 2 - bounds.width / 2,
    y: cssHeight / 2 - bounds.height / 2,
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
