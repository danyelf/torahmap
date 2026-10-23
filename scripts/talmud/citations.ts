// The Tanakh verses the Talmud cites. The Wikisource edition names each in brackets, (תהלים לו, ז);
// the Davidson edition, which the popup shows, quotes its words in ״…״ but names none.

import { hebrewNumber } from '@torahmap/hebrew';
import { parseVerseId, verseId } from '@torahmap/link/tanakh';
import { textWords } from '@torahmap/shell/textWords.ts';
import type { Book } from '@torahmap/tanakh/types.ts';
import type { Citation, TalmudTractateText } from '@torahmap/talmud/data.ts';

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

  const wordsOf = verseWords(tanakh);

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
        ((chapter, verse, count) => holdsRun(wordsOf(book.name, chapter, verse), quoted, count));
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

/** Each verse's words, spelled as quotes are compared, read once. */
function verseWords(tanakh: Tanakh): (book: string, chapter: number, verse: number) => string[] {
  const read = new Map<string, string[]>();
  return (book, chapter, verse) => {
    const key = `${book} ${chapter}:${verse}`;
    let words = read.get(key);
    if (!words) {
      words = textWords(tanakh.text(book, chapter, verse) ?? '')
        .map(({ word }) => spelling(letters(word)))
        .filter(Boolean);
      read.set(key, words);
    }
    return words;
  };
}

/**
 * Where a text that quotes verses in ״…״ without naming them quotes each of `verses`, in order:
 * the next quote holding two of the verse's words in a row, or its one word. A verse no quote
 * holds is left out.
 */
export function quoteFinder(
  tanakh: Tanakh,
): (text: string, verses: readonly string[]) => Citation[] {
  const wordsOf = verseWords(tanakh);
  return (text, verses) => {
    const quotes = quotesIn(text);
    const citations: Citation[] = [];
    let next = 0;
    for (const verse of verses) {
      const place = parseVerseId(verse);
      if (!place) continue;
      const words = wordsOf(place.book, place.chapter, place.verse);
      const at = quotes.findIndex(
        (q, i) => i >= next && holdsRun(words, q.words, Math.min(2, q.words.length)),
      );
      if (at < 0) continue;
      citations.push({ start: quotes[at].start, end: quotes[at].end, verse });
      next = at + 1;
    }
    return citations;
  };
}

// A quote mark before a word opens a quote, even after a prefix (לְ״רוֹפֵא״); any other closes one.
const OPENS = /[א-ת֑-ׇ]/;

/**
 * The stretches of `text` inside ״…״, trimmed, and their words as quotes are compared. A quote can
 * run on from the segment before, or into the next.
 */
function quotesIn(text: string): { start: number; end: number; words: string[] }[] {
  const quotes: { start: number; end: number; words: string[] }[] = [];
  const add = (from: number, to: number) => {
    const stretch = text.slice(from, to);
    const start = from + (stretch.length - stretch.trimStart().length);
    const end = from + stretch.trimEnd().length;
    const words = stretch
      .split(/\s+/)
      .map((written) => (/^ה[֑-ׇ]*['׳]$/.test(written) ? 'יהוה' : letters(written)))
      .filter((word) => word.length > 1 && word !== 'וגו')
      .map(spelling);
    if (end > start && words.length > 0) quotes.push({ start, end, words });
  };
  let from: number | null = null;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '״') continue;
    if (OPENS.test(text[i + 1] ?? '')) from = i + 1;
    else if (from !== null || first) {
      add(from ?? 0, i);
      from = null;
    }
    first = false;
  }
  if (from !== null) add(from, text.length);
  return quotes;
}

function isNumbered(shape: RegExpMatchArray | null): boolean {
  return !!shape && hebrewNumber(shape[1]) !== null && hebrewNumber(shape[2]) !== null;
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
  const chapter = hebrewNumber(chapterWritten);
  const verse = hebrewNumber(verseWritten);
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

/**
 * The citations in a tractate's text, by amud and segment: the verses `find` reads in each segment
 * of `naming`, an edition that names them, linked where the same segment of `text` quotes them.
 * Also every stretch that looked like a citation but named no verse, and the verses named but not
 * quoted.
 */
export function citationsByPlace(
  text: readonly (readonly string[])[],
  naming: readonly (readonly string[])[],
  find: (text: string) => Found,
  place: ReturnType<typeof quoteFinder>,
): { citations: TalmudTractateText['citations']; missed: string[]; unquoted: number } {
  const citations: TalmudTractateText['citations'] = {};
  const missed: string[] = [];
  let unquoted = 0;
  text.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const found = find(naming[ai]?.[si] ?? '');
      missed.push(...found.missed);
      const verses = found.citations.map(({ verse }) => verse);
      const placed = place(segment, verses);
      unquoted += verses.length - placed.length;
      if (placed.length > 0) (citations[ai] ??= {})[si] = placed;
    }),
  );
  return { citations, missed, unquoted };
}
