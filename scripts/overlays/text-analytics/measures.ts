/**
 * The Text Analytics overlay's measure, Repetitive wording: the share of a
 * verse's words that sit in a run of words its own book repeats nearby. A verse
 * is scored alone: averaged over its neighbours, a chapter such as Genesis 5
 * reads as one even block, and the verses that leave its formula (5:24, 5:29)
 * disappear.
 */

import type { ScoreParameters } from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import { words, repeatedStretches } from '@torahmap/tanakh/overlays/text-analytics/words.ts';

export { words, repeatedStretches };

/** Every value the measure depends on; the scores file records them for the legend. */
export const PARAMETERS = {
  /** Verses shorter than this get no score: short list items (Ezra 2) otherwise dominate the map. */
  minWords: 7,
  /**
   * Words in a repeated run. Four counts a chapter's technical formulas, such as
   * Leviticus 13's "the priest shall look at the plague", as repetition; five
   * nearly halves those, and passages that repeat themselves (Numbers 7, Job 1)
   * keep most of their score.
   */
  runWords: 5,
  /**
   * How far apart, in verses of the same book, a run may recur and still count:
   * near enough to catch a passage repeating itself (Numbers 7's cycle of six
   * verses), not so far as to reach distant parallels.
   */
  reachVerses: 50,
  /** A run found in this many books is a stock phrase ("thus says the LORD, God of Israel"), not a passage repeating itself. */
  formulaBooks: 5,
} as const satisfies ScoreParameters;

/** A book's verses in reading order, each its Hebrew text. */
export interface Book {
  name: string;
  verses: string[];
}

/** A book's verses, each as its words without points or accents. */
export interface ParsedBook {
  name: string;
  verses: string[][];
}

/** A verse's scores, parallel to its book's verses; null where a verse has none. */
export type BookScores = (number | null)[];

export function parse(book: Book): ParsedBook {
  return { name: book.name, verses: book.verses.map(words) };
}

/** The runs a verse holds, in order. */
export const runsIn = (verse: string[]): string[] =>
  Array.from({ length: Math.max(0, verse.length - PARAMETERS.runWords + 1) }, (_, p) =>
    verse.slice(p, p + PARAMETERS.runWords).join(' '),
  );

/** The runs found in enough books to be stock phrases. */
export function formulas(books: ParsedBook[]): Set<string> {
  const booksWith = new Map<string, Set<number>>();
  books.forEach(({ verses }, b) =>
    verses.forEach((verse) =>
      runsIn(verse).forEach((run) => {
        if (!booksWith.has(run)) booksWith.set(run, new Set());
        booksWith.get(run)!.add(b);
      }),
    ),
  );
  return new Set(
    [...booksWith].filter(([, b]) => b.size >= PARAMETERS.formulaBooks).map(([run]) => run),
  );
}

interface Place {
  verse: number;
  position: number;
}

/**
 * Every place in `verses` where a run recurs in its book within reach, with the other places it
 * recurs at; the one rule that repeated words and echoes both read.
 */
function recurrences(verses: string[][], stock: Set<string>): { place: Place; others: Place[] }[] {
  // Where each run is found in the book.
  const at = new Map<string, Place[]>();
  verses.forEach((verse, v) =>
    runsIn(verse).forEach((run, position) => {
      if (stock.has(run)) return;
      if (!at.has(run)) at.set(run, []);
      at.get(run)!.push({ verse: v, position });
    }),
  );

  const found: { place: Place; others: Place[] }[] = [];
  for (const places of at.values()) {
    for (const place of places) {
      const others = places.filter(
        (other) => other !== place && Math.abs(other.verse - place.verse) <= PARAMETERS.reachVerses,
      );
      if (others.length > 0) found.push({ place, others });
    }
  }
  return found;
}

/** Each book's verses, each word flagged when it sits in a run the book repeats nearby. */
export function repeatedWords(books: ParsedBook[], stock = formulas(books)): boolean[][][] {
  return books.map(({ verses }) => {
    const repeated = verses.map((verse) => new Array<boolean>(verse.length).fill(false));
    for (const { place } of recurrences(verses, stock)) {
      for (let k = 0; k < PARAMETERS.runWords; k++) {
        repeated[place.verse][place.position + k] = true;
      }
    }
    return repeated;
  });
}

/**
 * Each book's verses, each with the other verses it shares a repeated run with, as offsets in
 * reading order from it (negative before it), ascending.
 */
export function echoes(books: ParsedBook[], stock = formulas(books)): number[][][] {
  return books.map(({ verses }) => {
    const near = verses.map(() => new Set<number>());
    for (const { place, others } of recurrences(verses, stock)) {
      for (const other of others) {
        if (other.verse !== place.verse) near[place.verse].add(other.verse - place.verse);
      }
    }
    return near.map((offsets) => [...offsets].sort((a, b) => a - b));
  });
}

/** Each book's repetitive-wording scores, parallel to `books`. */
export function repetitionScores(books: ParsedBook[], stock = formulas(books)): BookScores[] {
  return repeatedWords(books, stock).map((verses) =>
    verses.map((marks) =>
      marks.length >= PARAMETERS.minWords ? marks.filter(Boolean).length / marks.length : null,
    ),
  );
}
