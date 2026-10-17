import type { BookTab, SectionLabelSize, SectionName } from '@torahmap/shell/mapLabels.ts';
import type { RowNumberStyle } from '@torahmap/shell/rowNumbers.ts';
import { SQUARE_GAP } from '@torahmap/engine';

export const SQUARE_SIZE = 6; // map units a square is tall, and a column's pitch

// Each square is nudged by a fixed amount from its id, as the Tanakh's and the Talmud's are.
// The Talmud's squares are the same size, so its ±0.7 map units and ±18% brightness carry over.
export const POSITION_JITTER = 0.7;
export const BRIGHTNESS_JITTER = 0.18;

export const COLUMN_WIDTH = 8; // squares across an article's column
export const RECITALS_PER_LINE = 50;

// Two squares: room for the article's label, which one square holds only from zoom 1.67. Three
// would let the labels show from 0.59, where a label is wider than a split chapter's column pitch.
export const ARTICLE_GAP = 2 * SQUARE_SIZE;
export const SECTION_GAP = 3 * SQUARE_SIZE; // between a chapter's sections, where it is not split
export const SPLIT_GAP = 2 * SQUARE_SIZE; // between a split chapter's columns
export const CHAPTER_GAP = 6 * SQUARE_SIZE;
export const LAYER_GAP = 12 * SQUARE_SIZE;
// Room above each layer's first row for the chapter tabs.
export const LABEL_ROOM = 40;

/** The chapter and annex names, tabs above their columns that scale with the map. */
export const CHAPTER_TAB: BookTab = { fontSize: 12, above: 28, inset: 4, minPx: 7 };
// The article numbers, the size of the Talmud's daf numbers, in the gap above each article and a
// pixel clear of it. They show once that gap, less the jitter of the squares on either side, holds
// them with a pixel to spare above as well: from zoom 0.87.
export const ARTICLE_NUMBER: RowNumberStyle = { fontSize: 9, offset: 1, side: 'above' };
export const ARTICLE_NUMBER_ZOOM =
  (ARTICLE_NUMBER.fontSize + 2 * ARTICLE_NUMBER.offset) /
  (ARTICLE_GAP + SQUARE_GAP - 2 * POSITION_JITTER);

export const LAYER_LABEL_SIZE: SectionLabelSize = { fontSize: 14, gapEm: 0.5 };

export const LAYER_NAMES: Readonly<Record<string, SectionName>> = {
  Recitals: { he: '', en: 'Recitals' },
  Articles: { he: '', en: 'Articles' },
  Annexes: { he: '', en: 'Annexes' },
};
