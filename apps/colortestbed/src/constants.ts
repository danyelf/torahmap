import type { BookTab, SectionLabelSize } from '@torahmap/shell/mapLabels.ts';

export const SQUARE_SIZE = 6; // map units a square is tall, and a column's pitch, as in the other texts

export const BLOCK_GAP = 2 * SQUARE_SIZE; // between the colours of a palette in one cell
export const ROW_GAP = 6 * SQUARE_SIZE; // between palettes
export const LABEL_ROOM = 40; // above each row, for the block-size tabs

export const BLOCK_TAB: BookTab = { fontSize: 12, above: 28, inset: 4, minPx: 7 };
export const PALETTE_LABEL_SIZE: SectionLabelSize = { fontSize: 14, gapEm: 0.5 };
