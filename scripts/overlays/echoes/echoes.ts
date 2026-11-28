/**
 * The verses that share a run of words, anywhere in the Tanakh, and how long the longest run they
 * share is.
 */

import { MAX_WORDS, MIN_WORDS } from '@torahmap/tanakh/overlays/echoes/data.ts';

/** A book's verses in reading order, each as its words without points or accents. */
export interface Book {
  name: string;
  verses: string[][];
}

/**
 * For each verse, counted from the first verse of the first book, the other verses it shares a run
 * with, as pairs of position and words in the longest such run (at most MAX_WORDS), by position.
 * A run pairs every verse it is in, however many: the formulas ("and the LORD spoke to Moses,
 * saying", in 70 verses) more than double the pairs, and formulas-report.ts lists them.
 */
export function echoesAnywhere(books: Book[]): [other: number, words: number][][] {
  const verses = books.flatMap(({ verses }) => verses);
  const longest = verses.map(() => new Map<number, number>());
  for (let n = MIN_WORDS; n <= MAX_WORDS; n++) {
    const at = new Map<string, Set<number>>();
    verses.forEach((verse, v) => {
      for (let p = 0; p + n <= verse.length; p++) {
        const run = verse.slice(p, p + n).join(' ');
        if (!at.has(run)) at.set(run, new Set());
        at.get(run)!.add(v);
      }
    });
    for (const sharing of at.values()) {
      if (sharing.size < 2) continue;
      for (const a of sharing) for (const b of sharing) if (a !== b) longest[a].set(b, n);
    }
  }
  return longest.map((others) => [...others].sort((a, b) => a[0] - b[0]));
}
