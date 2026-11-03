export const BRIGHTNESS_JITTER = 0.18; // a bar's brightness varies by this fraction, from its id

// Map units.
export const ROW = 6; // a bar is this tall, the size of the other texts' squares
export const CHAR = 0.5; // a character is this wide
export const MAX_CHARS = 100; // a column's width in characters; longer lines are clipped
export const MAX_ROWS = 200; // lines a column holds before the file continues in the next
export const STUB_CHARS = 8; // a deleted file's bar, in characters

// Each file sits on a shade, which sets it apart, so the gaps between files can be tight.
export const FILE_GAP = 10; // between files side by side
export const SHELF_GAP = 14; // between rows of files
export const COLUMN_GAP = 4; // between one file's columns
export const NAME_STRIP = 16; // above a file's first row, for its name
export const SHADE_REACH = 3; // how far a file's shade reaches past its bars and name strip

export const FOLDER_PAD = 12; // inside a folder's box, left, right and below
/** The strip at the top of a folder's box, for its name, by depth: the repository's folders are 1. */
export const tabHeight = (depth: number): number => (depth <= 1 ? 40 : depth === 2 ? 28 : 22);
export const FOLDER_ASPECT = 1.7; // a folder packs its contents to about this width over height
