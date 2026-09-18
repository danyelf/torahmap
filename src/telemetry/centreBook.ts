import type { Camera } from '../camera.ts';
import type { TanakhLayout } from '../types.ts';

/** The book of the verse nearest the middle of the screen. */
export function centreBook(
  verses: TanakhLayout[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
): string {
  // The inverse of panToCenter in camera.ts.
  const cx = cssWidth / 2 / camera.zoom - camera.x;
  const cy = cssHeight / 2 / camera.zoom - camera.y;
  let best = '';
  let bestDistance = Infinity;
  for (const v of verses) {
    const dx = v.x + v.size / 2 - cx;
    const dy = v.y + v.size / 2 - cy;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = v.book;
    }
  }
  return best;
}
