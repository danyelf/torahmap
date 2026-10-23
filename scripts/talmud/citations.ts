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

/** A verse a segment cites, as the edition that names it writes it. */
export interface Cited {
  verse: string;
  /** The reference as written, in round brackets: "(תהלים לו, ז)". */
  reference: string;
  /** The words that follow the reference, up to the next one, as quotes are compared. */
  after: string[];
  /** The words before the reference, nearest last, as quotes are compared. */
  before: string[];
}

/** How a citation found its place in a text that names no verse. */
export type Placing =
  /** Where the words that follow the reference are, in a quote or not. */
  | 'aligned'
  /** The next quote, which holds two of the verse's words in a row. */
  | 'quote'
  /** Part of the quote the verse before it was linked on, which holds this one's words too. */
  | 'shared'
  /** Three of the verse's words in a row, outside any quote. */
  | 'words'
  /** Nowhere: the reference itself is shown, where the words around it say. */
  | 'reference';

/** A word of a text: where it is, its letters as quotes are compared, and the quote it is in. */
interface Word {
  start: number;
  end: number;
  word: string;
  /** Whether it counts towards a quote's words: not a single letter, or וגו׳. */
  counts: boolean;
  /** Whether it counts when lining the editions up: neither (deleted) nor [added] by an editor. */
  aligns: boolean;
  /** The index of the quote it is in, or -1. */
  quote: number;
}

/**
 * Where a text that quotes verses in ״…״ without naming them cites each of `cited`, in order, and
 * how each was placed, trying each `Placing` in the order the code does. A verse placed none of
 * those ways is shown as its reference.
 */
export function quoteFinder(
  tanakh: Tanakh,
): (text: string, cited: readonly Cited[]) => { citation: Citation; placing: Placing }[] {
  const wordsOf = verseWords(tanakh);
  return (text, cited) => {
    const quotes = quotesIn(text);
    const words = wordsIn(text, quotes);
    const quoteWords = quotes.map((_, q) =>
      words.filter((w) => w.quote === q && w.counts).map((w) => w.word),
    );
    const placed: { citation: Citation; placing: Placing }[] = [];
    // Each citation comes after the one before it. The last link stays open to a split, when the
    // next verse's words begin inside its quote.
    let from = 0;
    let last = null as { quote: number; citation: Citation } | null;
    const wordFrom = (i: number) => words.findIndex((w) => w.start >= i);

    const add = (citation: Citation, placing: Placing, quote: number) => {
      placed.push({ citation, placing });
      from = citation.start + 1;
      last = quote >= 0 ? { quote, citation } : null;
    };
    /**
     * Links the verse at word `w`: its quote, the rest of the last quote, a quote that opens a word
     * or two later and holds the verse's words (אדם ״כי יהיה בעור בשרו״), or its run of the verse's words.
     */
    const linkAt = (
      w: number,
      verse: string,
      placing: Placing,
      run: Set<string>,
      holds: (quoted: string[]) => boolean,
    ): boolean => {
      const soon = words.slice(w + 1, w + 3).find((x) => x.quote >= 0)?.quote ?? -1;
      const quote =
        words[w].quote < 0 && soon >= 0 && soon !== last?.quote && holds(quoteWords[soon])
          ? soon
          : words[w].quote;
      if (quote >= 0 && quote === last?.quote) {
        if (words[w].start <= last.citation.start) return false;
        const end = last.citation.end;
        last.citation.end = words[w - 1].end;
        add({ start: words[w].start, end, verse }, 'shared', quote);
        return true;
      }
      if (quote >= 0) {
        add({ start: quotes[quote].start, end: quotes[quote].end, verse }, placing, quote);
        return true;
      }
      if (!run.has(words[w].word)) return false;
      let to = w;
      while (to + 1 < words.length && words[to + 1].quote < 0 && run.has(words[to + 1].word)) to++;
      add({ start: words[w].start, end: words[to].end, verse }, placing, -1);
      return true;
    };

    for (const c of cited) {
      const place = parseVerseId(c.verse);
      if (!place) continue;
      const verse = wordsOf(place.book, place.chapter, place.verse);
      const inVerse = new Set(verse);
      const holds = (quoted: string[]) =>
        quoted.length > 0 && holdsRun(verse, quoted, Math.min(2, quoted.length));

      // Wikisource joins a prefix to the quote it opens, לותמונת where Davidson has ל״ותמנת.
      const [first = '', second] = c.after;
      const prefixed = /^[בדהוכלמש]./.test(first) ? first.slice(1) : null;
      const aligned = [c.after.slice(0, 2), prefixed && [prefixed, second].filter(Boolean)]
        .map((run) => (run ? findRun(words, run, wordFrom(from)) : -1))
        .find((at) => at >= 0);
      if (aligned !== undefined && linkAt(aligned, c.verse, 'aligned', inVerse, holds)) continue;
      const q = quotes.findIndex(
        (span, i) => span.start >= from && i !== last?.quote && holds(quoteWords[i]),
      );
      if (q >= 0) {
        add({ start: quotes[q].start, end: quotes[q].end, verse: c.verse }, 'quote', q);
        continue;
      }
      const lastQuote = last?.quote ?? -1;
      if (lastQuote >= 0 && holds(quoteWords[lastQuote])) {
        const split = words.findIndex(
          (w) =>
            w.quote === lastQuote &&
            w.start > last!.citation.start &&
            w.counts &&
            inVerse.has(w.word),
        );
        if (split >= 0 && linkAt(split, c.verse, 'shared', inVerse, holds)) continue;
      }
      const outside = words.findIndex(
        (w, i) =>
          w.start >= from &&
          words.slice(i, i + 3).every((x) => x.quote < 0 && x.counts && inVerse.has(x.word)) &&
          holdsRun(
            verse,
            words.slice(i, i + 3).map((x) => x.word),
            3,
          ),
      );
      if (outside >= 0 && linkAt(outside, c.verse, 'words', inVerse, holds)) continue;

      const at = referencePlace(text, words, c, wordFrom(from));
      placed.push({
        citation: { start: at, end: at, verse: c.verse, reference: c.reference },
        placing: 'reference',
      });
      from = at;
      last = null;
    }
    return placed;
  };
}

/**
 * The index of the first word from `start` that begins a run of `run`, reading only the words that
 * count: a single letter or וגו׳ may stand in one edition and not the other.
 */
function findRun(words: readonly Word[], run: readonly string[], start: number): number {
  if (run.length === 0 || start < 0) return -1;
  const counted = words.flatMap((w, i) => (i >= start && w.aligns ? [i] : []));
  const at = counted.findIndex((_, i) =>
    run.every((word, k) => words[counted[i + k]]?.word === word),
  );
  return at < 0 ? -1 : counted[at];
}

/** Where to show a reference: before the words that follow it, after those before it, or at the end. */
function referencePlace(text: string, words: readonly Word[], cited: Cited, start: number): number {
  const following = findRun(words, cited.after.slice(0, 1), start);
  if (following >= 0) return words[following].start;
  const preceding = findRun(words, cited.before.slice(-1), start);
  if (preceding >= 0) return words[preceding].end;
  return text.length;
}

// A quote mark before a word or a bracket opens a quote, even after a prefix (לְ״רוֹפֵא״); any other
// closes one.
const OPENS = /[א-ת֑-ׇ([]/;

/**
 * The stretches of `text` inside ״…״, trimmed. A quote can run on from the segment before, or into
 * the next.
 */
function quotesIn(text: string): { start: number; end: number }[] {
  const quotes: { start: number; end: number }[] = [];
  const add = (from: number, to: number) => {
    const stretch = text.slice(from, to);
    const start = from + (stretch.length - stretch.trimStart().length);
    const end = from + stretch.trimEnd().length;
    if (end > start) quotes.push({ start, end });
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

/** The words of `text` that have letters, each with the quote it is in. */
function wordsIn(text: string, quotes: readonly { start: number; end: number }[]): Word[] {
  // What the editors bracketed, (deleted) or [added], one edition has and the other may not.
  const bracketed = [...text.matchAll(/[([][^()[\]]*[)\]]/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
  const within = (spans: readonly { start: number; end: number }[], start: number, end: number) =>
    spans.findIndex((s) => s.start <= start && end <= s.end);
  const words: Word[] = [];
  // A quote mark parts words: מ״גדלו is מ and the quote's first word.
  for (const match of text.matchAll(/[^\s״]+/g)) {
    // Without the punctuation either side.
    const core = match[0].match(/[א-ת](?:.*[א-ת֑-ׇ׳'])?/);
    if (!core) continue;
    const start = match.index + core.index!;
    const end = start + core[0].length;
    words.push({
      start,
      end,
      word: compared(core[0]),
      counts: counts(core[0]),
      aligns: counts(core[0]) && within(bracketed, start, end) < 0,
      quote: within(quotes, start, end),
    });
  }
  return words;
}

/** Whether a word counts towards matching: the name, or any word but a single letter or וגו׳. */
function counts(written: string): boolean {
  const plain = letters(written);
  return isName(written) || (plain.length > 1 && plain !== 'וגו');
}

const isName = (written: string) =>
  /^[^א-ת]*(?:ה[\u0591-\u05C7]*['׳]|י['"׳״]י)[^א-ת]*$/.test(written);

/** A written word as quotes and verses are compared: its letters, ה׳ or י״י read as the name. */
export function compared(written: string): string {
  return spelling(isName(written) ? 'יהוה' : letters(written));
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
 * of `naming`, an edition that names them, placed in the same segment of `text`. Also every stretch
 * that looked like a citation but named no verse, and how many citations were placed each way.
 */
export function citationsByPlace(
  text: readonly (readonly string[])[],
  naming: readonly (readonly string[])[],
  find: (text: string) => Found,
  place: ReturnType<typeof quoteFinder>,
): {
  citations: TalmudTractateText['citations'];
  missed: string[];
  placings: Partial<Record<Placing, number>>;
} {
  const citations: TalmudTractateText['citations'] = {};
  const missed: string[] = [];
  const placings: Partial<Record<Placing, number>> = {};
  text.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const names = naming[ai]?.[si] ?? '';
      const found = find(names);
      missed.push(...found.missed);
      const cited = found.citations.map(({ start, end, verse }, i) => ({
        verse,
        reference: `(${names.slice(start, end).trim()})`,
        after: wordsBetween(names, end + 1, found.citations[i + 1]?.start ?? names.length),
        before: wordsBetween(names, found.citations[i - 1]?.end ?? 0, start - 1),
      }));
      const placed = place(segment, cited);
      for (const { placing } of placed) placings[placing] = (placings[placing] ?? 0) + 1;
      if (placed.length > 0) (citations[ai] ??= {})[si] = placed.map(({ citation }) => citation);
    }),
  );
  return { citations, missed, placings };
}

/** The words of `text` from `start` to `end`, as quotes are compared, up to any bracket. */
function wordsBetween(text: string, start: number, end: number): string[] {
  return text
    .slice(start, end)
    .replace(/[([{][^)\]}]*[)\]}]?/g, ' ')
    .split(/\s+/)
    .filter(counts)
    .map(compared);
}
