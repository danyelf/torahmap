// The Tanakh verses the Talmud's text cites, written in brackets: (תהלים לו, ז).

import { verseId } from '@torahmap/link/tanakh';
import { textWords } from '@torahmap/shell/textWords.ts';
import type { Book } from '@torahmap/tanakh/types.ts';
import type { Citation, TalmudTractateText } from '@torahmap/talmud/data.ts';
import { hebrewNumeral } from './hebrewNumeral.ts';

export type TanakhBook = Pick<Book, 'name' | 'hebrewName' | 'chapters'>;

export interface Tanakh {
  books: readonly TanakhBook[];
  /** A verse's Hebrew; null for a verse there is no text for. */
  text: (book: string, chapter: number, verse: number) => string | null;
}

/** What a segment cites, and the bracketed stretches that look like citations but name no verse. */
export type Found = { citations: Citation[]; missed: string[] };

/** Spellings the Talmud uses beside the Tanakh's own Hebrew names. */
const SPELLINGS: Readonly<Record<string, string>> = {
  'תהילים': 'תהלים',
  'ישעיה': 'ישעיהו',
  'ירמיה': 'ירמיהו',
  'ש"א': 'שמואל א',
  'ש"ב': 'שמואל ב',
  'דה"א': 'דברי הימים א',
  'דה"ב': 'דברי הימים ב',
};

/** Citations Sefaria's text gets wrong, as written and as meant. */
const MISTAKES: Readonly<Record<string, string>> = {
  'ויקרא הכ, ו': 'ויקרא כה, ו',
  'ב דברי הימים ג, ב': 'דברי הימים ב ג, ב',
};

/** "The same book": the book the segment last named. */
const SAME_BOOK = 'שם';

// The Talmud's editors number some chapters as other editions do, putting a citation up to three
// verses from the verse whose words it quotes, as around the Ten Commandments.
const NEARBY = 3;

const BRACKETED = /[(\[{]([^()[\]{}]*)[)\]}]/g;
const NUMERAL = `[א-ת'"׳״]+`;
// A chapter and a verse, then perhaps the end of a range, or a second verse after a backslash.
const CHAPTER_AND_VERSE = new RegExp(
  `^(${NUMERAL})\\s*(?:[,:]\\s*|\\s+)(${NUMERAL})(?:\\s*[-\\\\]\\s*${NUMERAL})?$`,
);
// Any words, then a chapter and verse set apart by a comma or colon: how a citation of a book not
// known here looks.
const CITATION_SHAPE = new RegExp(`^\\S.*\\s(${NUMERAL})\\s*[,:]\\s*(${NUMERAL})(?:-${NUMERAL})?$`);

/** What a segment's text cites, read against `tanakh`; the book names are read once. */
export function citationFinder(tanakh: Tanakh): (text: string) => Found {
  const byName = new Map<string, TanakhBook>(tanakh.books.map((book) => [book.hebrewName, book]));
  for (const [spelling, name] of Object.entries(SPELLINGS)) {
    const book = byName.get(name);
    if (book) byName.set(spelling, book);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);

  // Each verse's words, spelled as quotes are compared, read once.
  const read = new Map<string, string[]>();
  const wordsOf = (book: TanakhBook, chapter: number, verse: number): string[] => {
    const key = `${book.name} ${chapter}:${verse}`;
    let words = read.get(key);
    if (!words) {
      words = textWords(tanakh.text(book.name, chapter, verse) ?? '')
        .map(({ word }) => spelling(letters(word)))
        .filter(Boolean);
      read.set(key, words);
    }
    return words;
  };

  return (text) => {
    const citations: Citation[] = [];
    const missed: string[] = [];
    let lastBook: TanakhBook | null = null;
    for (const match of text.matchAll(BRACKETED)) {
      const inside = match[1].trim();
      if (!inside) continue;
      // "מלכים א' ו ז": the geresh on a numbered book's letter.
      const words = (MISTAKES[inside] ?? inside).replace(/(\s[אב])['׳](?=\s)/g, '$1');
      const startsWith = (n: string) => words.startsWith(n) && /\s/.test(words[n.length] ?? '');
      const name: string | null =
        names.find(startsWith) ?? (lastBook && startsWith(SAME_BOOK) ? SAME_BOOK : null);
      const book: TanakhBook | null =
        name === SAME_BOOK ? lastBook : name ? byName.get(name)! : null;
      const numbers = name && words.slice(name.length).trim().match(CHAPTER_AND_VERSE);
      if (!book || !numbers) {
        if (!name && isNumbered(words.match(CITATION_SHAPE))) missed.push(match[0]);
        continue;
      }
      lastBook = book;
      const quoted = quote(text.slice(match.index + match[0].length));
      const holds: Holds | null =
        quoted &&
        ((chapter, verse, count) => holdsRun(wordsOf(book, chapter, verse), quoted, count));
      const verse = verseIn(book, numbers[1], numbers[2], holds);
      if (!verse) {
        missed.push(match[0]);
        continue;
      }
      const start = match.index + 1 + match[1].indexOf(inside);
      citations.push({ start, end: start + inside.length, verse });
    }
    return { citations, missed };
  };
}

function isNumbered(shape: RegExpMatchArray | null): boolean {
  return !!shape && hebrewNumeral(shape[1]) !== null && hebrewNumeral(shape[2]) !== null;
}

/** Whether a verse holds `count` of the words quoted, one after another. */
type Holds = (chapter: number, verse: number, count: number) => boolean;

/** The three words that follow a citation, spelled as verses are compared; null when fewer follow. */
function quote(after: string): string[] | null {
  // Two words often recur in a nearby verse; three seldom do.
  const words: string[] = [];
  for (const written of after.split(/[([{]/)[0].split(/\s+/)) {
    const word = letters(written);
    if (/^ה['׳]$/.test(written)) words.push('יהוה');
    else if (word === 'וגו') continue;
    // Any other abbreviation ends the quote.
    else if (/['"׳״]/.test(written)) break;
    else if (word.length > 1) words.push(word);
    if (words.length === 3) break;
  }
  return words.length < 3 ? null : words.map(spelling);
}

function holdsRun(
  verseWords: readonly string[],
  quoted: readonly string[],
  count: number,
): boolean {
  return verseWords.some((_, at) =>
    quoted.some(
      (_, from) =>
        from + count <= quoted.length &&
        quoted.slice(from, from + count).every((word, i) => verseWords[at + i] === word),
    ),
  );
}

function letters(word: string): string {
  return word.replace(/[^א-ת]/g, '');
}

/** A word without the vav and yod that some spellings add and others leave out. */
function spelling(word: string): string {
  return word.replace(/[וי]/g, '');
}

/**
 * The verse a citation names: the one written, unless a verse nearby holds the three words it quotes
 * and the one written holds not even two of them.
 */
function verseIn(
  book: TanakhBook,
  chapterWritten: string,
  verseWritten: string,
  holds: Holds | null,
): string | null {
  const chapter = hebrewNumeral(chapterWritten);
  const verse = hebrewNumeral(verseWritten);
  if (!chapter || !verse) return null;
  const length = book.chapters[chapter - 1] ?? 0;
  const exists = (v: number) => v >= 1 && v <= length;
  if (holds && !(exists(verse) && holds(chapter, verse, 2))) {
    for (let distance = 1; distance <= NEARBY; distance++) {
      for (const near of [verse - distance, verse + distance]) {
        if (exists(near) && holds(chapter, near, 3)) return verseId(book.name, chapter, near);
      }
    }
  }
  return exists(verse) ? verseId(book.name, chapter, verse) : null;
}

/** The citations in a tractate's text, by amud and segment, and every stretch that was missed. */
export function citationsByPlace(
  amudim: readonly (readonly string[])[],
  find: (text: string) => Found,
): { citations: TalmudTractateText['citations']; missed: string[] } {
  const citations: TalmudTractateText['citations'] = {};
  const missed: string[] = [];
  amudim.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const found = find(segment);
      missed.push(...found.missed);
      if (found.citations.length > 0) (citations[ai] ??= {})[si] = found.citations;
    }),
  );
  return { citations, missed };
}
