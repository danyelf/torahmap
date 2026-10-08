import type { ScreenPoint } from './camera.ts';

/**
 * A pointer's position in the map's own coordinates, which the camera, hit
 * detection and the labels all use: measured from the canvas's top-left
 * corner rather than the window's.
 */
export function mapPoint(
  clientX: number,
  clientY: number,
  origin: { left: number; top: number },
): ScreenPoint {
  return { x: clientX - origin.left, y: clientY - origin.top };
}
