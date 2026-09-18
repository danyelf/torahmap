import type { Camera } from '../camera.ts';

/** Whether the camera differs from the last position recorded, in x, y or zoom. */
export function cameraMoved(last: Camera | null, current: Camera): boolean {
  if (!last) return true;
  return last.x !== current.x || last.y !== current.y || last.zoom !== current.zoom;
}
