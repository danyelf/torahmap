/**
 * The verses that share a run of words, anywhere in the Tanakh, and how long the longest run they
 * share is. Words are counted as the repetitive-wording measure counts them.
 */

import { MAX_WORDS, MIN_WORDS } from '@torahmap/tanakh/overlays/text-analytics/echoes.ts';
import type { ParsedBook } from './measures.ts';

/**
 * A run found in more verses than this is a formula that recurs wherever it appears ("and the
 * LORD spoke to Moses, saying"), and pairs no verses by it. Numbers 7's twelve princes repeat
 * their offering in twelve verses, so twelve is the least that keeps it; fifteen leaves a margin.
 * Letting the limit grow with the run's length changes nothing on the list of famous parallels.
 */
export const MAX_VERSES_PER_RUN = 15;

/**
 * For each verse, counted from the first verse of the first book, the other verses it shares a run
 * with, as pairs of position and words in the longest such run (at most MAX_WORDS), by position.
 */
export function echoesAnywhere(
  books: ParsedBook[],
  maxVerses = MAX_VERSES_PER_RUN,
): [other: number, words: number][][] {
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
      if (sharing.size < 2 || sharing.size > maxVerses) continue;
      for (const a of sharing) for (const b of sharing) if (a !== b) longest[a].set(b, n);
    }
  }
  return longest.map((others) => [...others].sort((a, b) => a[0] - b[0]));
}
