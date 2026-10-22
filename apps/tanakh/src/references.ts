// Reads a reference to the Tanakh, such as "I Samuel 3:17" or שמואל א ג:יז.

import { foldFinalLetters, soundOfName } from '@torahmap/hebrew';
import { verseId } from '@torahmap/link/tanakh';
import type { GoTo, Reference } from '@torahmap/shell/app/text.ts';
import {
  numberIn,
  type Fold,
  RANGE,
  referenceReader,
  type Token,
} from '@torahmap/shell/references.ts';

export const EXAMPLES = ['II Samuel 17', 'Genesis 2:2', 'Shemot 4:1', 'שמות כב'];

/** A book as the reader needs it: its names and how many verses each chapter has. */
export interface ReferencedBook {
  name: string;
  hebrewName: string;
  chapters: readonly number[];
}

// English names that are not the start of a book's name: the usual abbreviations and other titles.
const ENGLISH_NAMES: Record<string, readonly string[]> = {
  Judges: ['Jdg'],
  'I Kings': ['I Kgs'],
  'II Kings': ['II Kgs'],
  Ezekiel: ['Ezk'],
  Psalms: ['Pss'],
  'Song of Songs': ['Song of Solomon', 'Canticles'],
  Ecclesiastes: ['Qoh'],
  'I Chronicles': ['I Chr'],
  'II Chronicles': ['II Chr'],
};

// The books' Hebrew names in English letters, matched however they are spelled.
const HEBREW_NAMES: Record<string, readonly string[]> = {
  Genesis: ['Bereshit', 'Bereishit'],
  Exodus: ['Shemot'],
  Leviticus: ['Vayikra'],
  Numbers: ['Bamidbar', 'Bemidbar'],
  Deuteronomy: ['Devarim'],
  Joshua: ['Yehoshua'],
  Judges: ['Shoftim'],
  'I Samuel': ['I Shmuel'],
  'II Samuel': ['II Shmuel'],
  'I Kings': ['I Melakhim'],
  'II Kings': ['II Melakhim'],
  Isaiah: ['Yeshayahu'],
  Jeremiah: ['Yirmiyahu'],
  Ezekiel: ['Yechezkel'],
  Hosea: ['Hoshea'],
  Joel: ['Yoel'],
  Obadiah: ['Ovadiah'],
  Jonah: ['Yonah'],
  Zephaniah: ['Tzefaniah'],
  Psalms: ['Tehillim'],
  Proverbs: ['Mishlei'],
  Job: ['Iyov'],
  'Song of Songs': ['Shir HaShirim'],
  Lamentations: ['Eikhah'],
  Ecclesiastes: ['Qohelet', 'Kohelet'],
  'I Chronicles': ['I Divrei HaYamim'],
  'II Chronicles': ['II Divrei HaYamim'],
};

// A numbered book's I, II or III, read as its number so that "I Sam" and "1 Sam" are one.
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' };

const numbered =
  (fold: (word: string) => string): Fold =>
  ([first, ...rest]) =>
    [ROMAN[first] ?? first, ...rest].map(fold).join('');

// Names as written, then as they sound.
const FOLDS = [numbered(foldFinalLetters), numbered(soundOfName)];

// Words a reference may carry that name no number.
const FILLER = new Set([
  'chapter',
  'ch',
  'chap',
  'verse',
  'verses',
  'v',
  'vv',
  'פרק',
  'פסוק',
  'פסוקים',
]);

type Place = { chapter: number; verse?: number };

/**
 * The verses from `from` to `to`, or null when either end is missing or they
 * run backwards. A place without a verse starts at its first and ends at its last.
 */
function versesBetween(book: ReferencedBook, from: Place, to: Place): string[] | null {
  const counts = book.chapters;
  const has = (p: Place) =>
    p.chapter >= 1 &&
    p.chapter <= counts.length &&
    (p.verse === undefined || (p.verse >= 1 && p.verse <= counts[p.chapter - 1]));
  if (!has(from) || !has(to)) return null;
  const endVerse = to.verse ?? counts[to.chapter - 1];
  const startVerse = from.verse ?? 1;
  if (to.chapter < from.chapter || (to.chapter === from.chapter && endVerse < startVerse)) {
    return null;
  }
  const ids: string[] = [];
  for (let c = from.chapter; c <= to.chapter; c++) {
    const first = c === from.chapter ? startVerse : 1;
    const last = c === to.chapter ? endVerse : counts[c - 1];
    for (let v = first; v <= last; v++) ids.push(verseId(book.name, c, v));
  }
  return ids;
}

const written = (p: Place) => (p.verse === undefined ? `${p.chapter}` : `${p.chapter}:${p.verse}`);

/** The place `rest`, after the book's name, gives in `book`: all of it, a chapter, a verse or a range. */
function placeIn(book: ReferencedBook, rest: Token[]): Reference | null {
  if (rest.length === 0) {
    const last = book.chapters.length;
    const ids = versesBetween(book, { chapter: 1 }, { chapter: last });
    return ids && { ref: book.name, ids };
  }

  const dash = rest.findIndex((t) => t.text === RANGE);
  const numbers = (tokens: Token[]) => tokens.map(numberIn);
  const before = numbers(dash === -1 ? rest : rest.slice(0, dash));
  const after = dash === -1 ? null : numbers(rest.slice(dash + 1));
  if ([...before, ...(after ?? [])].some((n) => n === null)) return null;
  if (before.length > 2 || (after && (after.length === 0 || after.length > 2))) return null;

  const from: Place = { chapter: before[0]!, verse: before[1] ?? undefined };
  // "1:2-3" ends at verse 3 of chapter 1; "1-2" at chapter 2.
  const to: Place = !after
    ? from
    : after.length === 2
      ? { chapter: after[0]!, verse: after[1]! }
      : from.verse === undefined
        ? { chapter: after[0]! }
        : { chapter: from.chapter, verse: after[0]! };

  const ids = versesBetween(book, from, to);
  if (!ids) return null;
  const end = !after
    ? ''
    : to.chapter === from.chapter
      ? `–${to.verse ?? to.chapter}`
      : `–${written(to)}`;
  return { ref: `${book.name} ${written(from)}${end}`, ids };
}

/** Reads a reference to one of `books`: a book, a chapter, a verse, or a range of them. */
export function verseReader(books: readonly ReferencedBook[]): Omit<GoTo, 'examples'> {
  const { read, completeNames } = referenceReader({
    named: books.map((book) => ({
      key: book,
      names: [
        book.name,
        book.hebrewName,
        ...(ENGLISH_NAMES[book.name] ?? []),
        ...(HEBREW_NAMES[book.name] ?? []),
      ],
      spellings: [book.hebrewName, ...(HEBREW_NAMES[book.name] ?? [])],
    })),
    folds: FOLDS,
    filler: FILLER,
    place: placeIn,
  });
  return { read, complete: completeNames };
}
