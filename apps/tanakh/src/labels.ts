// What the Tanakh's map labels call its books and sections, and where they go.

import type { BookBox, SectionLabelSize, SectionName } from '@torahmap/shell/mapLabels.ts';
import type { Book, TanakhLayout } from './types.ts';

export const SECTION_NAMES: Record<string, SectionName> = {
  torah: { he: 'תורה', en: 'Five Books' },
  neviim: { he: 'נביאים', en: 'Prophets' },
  ketuvim: { he: 'כתובים', en: 'Writings' },
};

// The longest section label is about 275 units at 32, against the shortest section's 470.
export const SECTION_SIZE: SectionLabelSize = { fontSize: 32, gapEm: 0.5 };

/** Each book's box around its verses, in the order the books first appear. */
export function bookBoxes(
  verses: readonly TanakhLayout[],
  books: readonly Book[],
): (BookBox & { maxY: number })[] {
  const byName = new Map(books.map((b) => [b.name, b]));
  const boxes = new Map<string, BookBox & { maxY: number }>();
  for (const v of verses) {
    const b = boxes.get(v.book);
    if (!b) {
      const book = byName.get(v.book);
      boxes.set(v.book, {
        name: v.book,
        hebrewName: book?.hebrewName ?? v.book,
        section: book?.section ?? 'neviim',
        minX: v.x,
        maxX: v.x + v.size,
        minY: v.y,
        maxY: v.y + v.size,
      });
      continue;
    }
    b.minX = Math.min(b.minX, v.x);
    b.maxX = Math.max(b.maxX, v.x + v.size);
    b.minY = Math.min(b.minY, v.y);
    b.maxY = Math.max(b.maxY, v.y + v.size);
  }
  return [...boxes.values()];
}
