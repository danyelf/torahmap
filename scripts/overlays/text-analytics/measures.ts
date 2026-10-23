/**
 * The Text analytics overlay's measure, Repetitive wording: the share of a
 * verse's words that sit in a run of words its own book repeats nearby. A verse
 * is scored alone: averaged over its neighbours, a chapter such as Genesis 5
 * reads as one even block, and the verses that leave its formula (5:24, 5:29)
 * disappear. A short verse gets no score.
 *
 * A maqaf-joined group counts as one word.
 */

import { withoutKetiv, wordsBhsaParsed } from '@torahmap/tanakh/search/dictionary.ts';
import type { ScoreParameters } from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import { isHebrew } from '@torahmap/hebrew';

/** Verses shorter than this get no score: short list items (Ezra 2) otherwise dominate the map. */
export const MIN_WORDS = 7;

/**
 * Words in a repeated run. Three counts a chapter's technical formulas, such as
 * Leviticus 13's "the priest shall look at the plague", as repetition; four
 * keeps passages that repeat themselves (Numbers 7, Job 1) and halves those.
 */
export const RUN_WORDS = 4;

/**
 * How far apart, in verses of the same book, a run may recur and still count:
 * near enough to catch a passage repeating itself (Numbers 7's cycle of six
 * verses), not so far as to reach distant parallels.
 */
export const REACH_VERSES = 50;

/** A run found in this many books is a stock phrase ("thus says the LORD, God of Israel"), not a passage repeating itself. */
export const FORMULA_BOOKS = 5;

/** Every value above that a reader is told, as the scores file records them. */
export const PARAMETERS: ScoreParameters = {
  minWords: MIN_WORDS,
  runWords: RUN_WORDS,
  reachVerses: REACH_VERSES,
  formulaBooks: FORMULA_BOOKS,
};

/** A book's verses in reading order, each its Hebrew text. */
export interface Book {
  name: string;
  verses: string[];
}

/** A book's verses, each as its words. */
export interface ParsedBook {
  name: string;
  verses: Unit[][];
}

/** A verse's scores, parallel to its book's verses; null where a verse has none. */
export type BookScores = (number | null)[];

/** A word as the measure reads it: a maqaf-joined group counts as one. */
export interface Unit {
  /** Letters and maqaf only, so that two spellings with different points match. */
  consonants: string;
}

const MAQAF = '\u05be';

/** The words of a verse, by their consonants. */
export function units(he: string): Unit[] {
  const words = wordsBhsaParsed(he);
  // A maqaf joins the word read aloud, so it is looked for with the ketiv
  // blanked and the brackets around the qere set aside.
  const read = withoutKetiv(he);
  const joinedByMaqaf = (from: number, to: number): boolean =>
    read.slice(from, to).replace(/[\s[\]]/g, '') === MAQAF;
  const result: Unit[] = [];
  words.forEach(({ word, start }, i) => {
    const consonants = [...word].filter(isHebrew).join('');

    const joined = i > 0 && joinedByMaqaf(words[i - 1].end, start);
    const last = result[result.length - 1];
    if (joined && last) {
      last.consonants += MAQAF + consonants;
    } else {
      result.push({ consonants });
    }
  });
  return result;
}

export function parse(book: Book): ParsedBook {
  return { name: book.name, verses: book.verses.map(units) };
}

/** Each verse's words, by consonants. */
const wordsOf = (books: ParsedBook[]): string[][][] =>
  books.map((b) => b.verses.map((v) => v.map((u) => u.consonants)));

/** The runs a verse holds, in order. */
const runsIn = (verse: string[], words = RUN_WORDS): string[] =>
  Array.from({ length: Math.max(0, verse.length - words + 1) }, (_, p) =>
    verse.slice(p, p + words).join(' '),
  );

/** The runs found in enough books to be stock phrases. */
export function formulas(books: ParsedBook[], words = RUN_WORDS): Set<string> {
  const booksWith = new Map<string, Set<number>>();
  wordsOf(books).forEach((verses, b) =>
    verses.forEach((verse) =>
      runsIn(verse, words).forEach((run) => {
        if (!booksWith.has(run)) booksWith.set(run, new Set());
        booksWith.get(run)!.add(b);
      }),
    ),
  );
  return new Set([...booksWith].filter(([, b]) => b.size >= FORMULA_BOOKS).map(([run]) => run));
}

/** Each book's repetitive-wording scores, parallel to `books`. */
export function repetitionScores(
  books: ParsedBook[],
  reach = REACH_VERSES,
  words = RUN_WORDS,
): BookScores[] {
  const stock = formulas(books, words);
  return wordsOf(books).map((verses) => {
    // Where each run is found in the book.
    const at = new Map<string, { verse: number; position: number }[]>();
    verses.forEach((verse, v) =>
      runsIn(verse, words).forEach((run, position) => {
        if (stock.has(run)) return;
        if (!at.has(run)) at.set(run, []);
        at.get(run)!.push({ verse: v, position });
      }),
    );

    const repeated = verses.map((verse) => new Array<boolean>(verse.length).fill(false));
    for (const places of at.values()) {
      if (places.length < 2) continue;
      for (const place of places) {
        const recurs = places.some(
          (other) => other !== place && Math.abs(other.verse - place.verse) <= reach,
        );
        if (!recurs) continue;
        for (let k = 0; k < words; k++) repeated[place.verse][place.position + k] = true;
      }
    }

    return repeated.map((marks) =>
      marks.length >= MIN_WORDS ? marks.filter(Boolean).length / marks.length : null,
    );
  });
}
