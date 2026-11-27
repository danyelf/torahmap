export const BRIGHTNESS_JITTER = 0.18; // a bar's brightness varies by this fraction, from its id

// Map units.
export const ROW = 6; // a bar is this tall, the size of the other texts' squares
export const CHAR = 0.5; // a character is this wide
export const COLUMN_CHARS = 80; // a column's width in characters; longer lines are clipped
export const COLUMN_MARGIN = 12; // between columns; folder edges are drawn in it
export const STUB_CHARS = 8; // a deleted file's bar, in characters

/** Prose lines are this much of a line of code, in height and so in area. */
export const PROSE_WEIGHT = 1 / 3;
export const isProse = (path: string): boolean => /\.(md|txt)$/.test(path);

export const MAP_ASPECT = 1.4; // the whole map's width over its height
/** The map's area over the area its lines need: the room rounding to whole columns takes up. */
export const SLACK = 1.15;
export const FOLDER_STRIP = 22; // at the top of a folder's box, for its name; at most a quarter of it
export const FOLDER_PAD = 6; // inside the foot of a folder's box; at most a quarter of it
export const FILE_PAD = 1; // above and below a file's lines
