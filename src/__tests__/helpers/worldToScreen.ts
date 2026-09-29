import type { Camera, ScreenPoint, Viewport } from '../../camera';

/** Where a map point lands on the canvas: the inverse of camera.ts's screenToWorld. */
export function worldToScreen(
  p: { x: number; y: number },
  camera: Camera,
  viewport: Viewport,
): ScreenPoint {
  return {
    x: (p.x - camera.x) * camera.zoom + viewport.width / 2,
    y: (p.y - camera.y) * camera.zoom + viewport.height / 2,
  };
}
