import type { Camera } from '../camera.ts';
import { findNearestItem, screenToWorld } from '../hitDetection.ts';
import type { TanakhLayout } from '../types.ts';

/** The book of the verse nearest the middle of the screen. */
export function centreBook(
  verses: TanakhLayout[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
): string {
  const { x, y } = screenToWorld(cssWidth / 2, cssHeight / 2, camera);
  return findNearestItem(verses, x, y)?.book ?? '';
}
