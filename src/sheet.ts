// The heights a phone's bottom sheet snaps to: lowered to its summary line,
// normal, or tall for reading and searching.

export type Sheet = 'down' | 'normal' | 'tall';

const ORDER: Sheet[] = ['down', 'normal', 'tall'];

/** How far a finger must travel to count as a drag rather than a tap. */
export const DRAG_PX = 10;

/** Where a vertical drag of `dy` leaves the sheet: one height, or null for a tap. */
export function sheetAfterDrag(sheet: Sheet, dy: number): Sheet | null {
  if (Math.abs(dy) < DRAG_PX) return null;
  const at = ORDER.indexOf(sheet) + (dy < 0 ? 1 : -1);
  return ORDER[Math.min(Math.max(at, 0), ORDER.length - 1)];
}

/** A tap on the grabber toggles normal and tall, and raises a lowered sheet. */
export function sheetAfterTap(sheet: Sheet): Sheet {
  return sheet === 'normal' ? 'tall' : 'normal';
}
