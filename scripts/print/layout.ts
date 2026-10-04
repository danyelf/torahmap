// The site's layout with Psalms in three columns, which makes the map short
// enough to fill a 36-inch sheet's width with the key beneath it.

import { verseToUrlFormat } from '@torahmap/link';
import { computeLayout } from '../../src/layout.ts';
import type { TanakhLayout, TorahData } from '../../src/types.ts';

/** The first chapter of each Psalms column. */
export const PSALMS_COLUMNS = [1, 51, 101] as const;

// computeLayout makes at most two columns of a book, so the third goes in as a
// book of its own, laid right after Psalms, and is renamed afterwards.
const THIRD_COLUMN = 'Psalms, third column';

export function threeColumnPsalms(structure: TorahData): TorahData {
  const [, second, third] = PSALMS_COLUMNS;
  return {
    books: structure.books.flatMap((b) =>
      b.name !== 'Psalms'
        ? [b]
        : [
            { ...b, chapters: b.chapters.slice(0, third - 1) },
            { ...b, name: THIRD_COLUMN, chapters: b.chapters.slice(third - 1) },
          ],
    ),
    layout: {
      ...structure.layout,
      multiColumnBooks: {
        ...structure.layout.multiColumnBooks,
        Psalms: { splitAtChapter: second - 1 },
      },
    },
  };
}

export function printLayout(structure: TorahData): TanakhLayout[] {
  const offset = PSALMS_COLUMNS[2] - 1;
  return computeLayout(threeColumnPsalms(structure)).map((v) => {
    if (v.book !== THIRD_COLUMN) return v;
    const chapter = v.chapter + offset;
    return { ...v, id: verseToUrlFormat('Psalms', chapter, v.verse), book: 'Psalms', chapter };
  });
}
