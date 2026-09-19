// The heights a phone's bottom sheet snaps to: lowered to its summary line,
// normal, or tall for reading and searching.

export type Sheet = 'down' | 'normal' | 'tall';

const ORDER: Sheet[] = ['down', 'normal', 'tall'];

/** How far the grabber must travel to count as a drag rather than a tap. */
export const DRAG_PX = 24;

/**
 * Where a gesture on the grabber leaves the sheet: a drag up or down moves it
 * one height, and a tap toggles between normal and tall.
 */
export function sheetAfterGesture(sheet: Sheet, dy: number): Sheet {
  const at = ORDER.indexOf(sheet);
  if (dy <= -DRAG_PX) return ORDER[Math.min(at + 1, ORDER.length - 1)];
  if (dy >= DRAG_PX) return ORDER[Math.max(at - 1, 0)];
  return sheet === 'normal' ? 'tall' : 'normal';
}
