// The verses of the Tanakh in reading order.

import { memoByValue } from '@torahmap/utils';
import { verseId } from '@torahmap/link/tanakh';
import type { ScoresFile } from './scores.ts';

export interface Place {
  id: string;
  book: string;
  chapter: number;
  verse: number;
}

/** Every verse from Genesis 1:1, and each verse's position by id. */
export const readingOrder = memoByValue((scores: ScoresFile) => {
  const places: Place[] = [];
  const positions = new Map<string, number>();
  for (const [book, chapters] of Object.entries(scores.repetition)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (let verse = 1; verse <= verses.length; verse++) {
        const id = verseId(book, Number(chapter), verse);
        positions.set(id, places.length);
        places.push({ id, book, chapter: Number(chapter), verse });
      }
    }
  }
  return { places, positions };
});
