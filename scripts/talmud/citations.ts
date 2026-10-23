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

// Two words in a row place a verse in a quote. Two often recur in a nearby verse; three seldom do, so
// three place a verse outside any quote, or move a citation to the nearby verse that holds them.
const RUN = 2;
const SURE_RUN = 3;

// A word in this many verses or more, such as אמר or כל, says nothing of which verse is quoted.
const COMMON = 100;

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

type VerseWords = (book: string, chapter: number, verse: number) => string[];
const verseWordsOf = new WeakMap<Tanakh, VerseWords>();

/** Each verse's words, as quotes are compared, read once for each Tanakh. */
function verseWords(tanakh: Tanakh): VerseWords {
  let wordsOf = verseWordsOf.get(tanakh);
  if (!wordsOf) {
    const read = new Map<string, string[]>();
    wordsOf = (book, chapter, verse) => {
      const key = `${book} ${chapter}:${verse}`;
      let words = read.get(key);
      if (!words) {
        words = textWords(tanakh.text(book, chapter, verse) ?? '')
          .map(({ word }) => compared(word))
          .filter(Boolean);
        read.set(key, words);
      }
      return words;
    };
    verseWordsOf.set(tanakh, wordsOf);
  }
  return wordsOf;
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
  /** Ended the segment before this one, or nearly: it may take only a quote that opens this one. */
  carried?: boolean;
}

/** How a citation found its place in a text that names no verse. */
export type Placing =
  /** A quote that holds two of the verse's words in a row, or its one word. */
  | 'quote'
  /** Part of the quote the verse before it was linked on, from where this verse's words begin. */
  | 'shared'
  /** Three of the verse's words in a row, outside any quote. */
  | 'words'
  /** Where the words after the reference are: words that share an uncommon word of the verse. */
  | 'variant'
  /** A quote that opens the next segment, where the reference ends its own. */
  | 'next'
  /** Nowhere, but the segment links the same verse already: nothing more is shown. */
  | 'again'
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

/** Which of the places that hold a verse it takes, where the reference does not say. */
const BY_PREFERENCE: readonly Placing[] = ['quote', 'shared', 'words'];

/** A citation placed in a text, how, and the verse as cited. */
export interface Placed {
  /** Null where the segment links the same verse already. */
  citation: Citation | null;
  placing: Placing;
  cited: Cited;
}

/** A place a verse could be linked on: words `first` to `last`, and how it was found. */
interface Candidate {
  first: number;
  last: number;
  placing: Placing;
}

/**
 * Where a text that quotes verses in ״…״ without naming them cites each of `cited`, in order, and
 * how. A verse is linked only on words that hold it: a quote, part of one, or a run of its words
 * outside any quote. Of the places that do, it takes the one where the words that follow the
 * reference in the naming edition are, if an uncommon word of the verse is there, or else the
 * first, a longer quote before a one-word one. Where none do, words where the reference's words
 * are that share an uncommon word of the verse. A verse placed none of these ways is shown as its
 * reference.
 */
export function quoteFinder(tanakh: Tanakh): (text: string, cited: readonly Cited[]) => Placed[] {
  const wordsOf = verseWords(tanakh);
  const versesWith = new Map<string, number>();
  for (const book of tanakh.books) {
    book.chapters.forEach((count, ci) => {
      for (let v = 1; v <= count; v++) {
        for (const word of new Set(wordsOf(book.name, ci + 1, v))) {
          versesWith.set(word, (versesWith.get(word) ?? 0) + 1);
        }
      }
    });
  }
  return (text, cited) => {
    const quotes = quotesIn(text);
    const words = wordsIn(text, quotes);
    const counted = (from: number, to: number) =>
      words
        .slice(from, to + 1)
        .filter((w) => w.counts)
        .map((w) => w.word);
    const quoteWords = quotes.map((_, q) => {
      const inQuote = words.flatMap((w, i) => (w.quote === q ? [i] : []));
      return { first: inQuote[0] ?? -1, last: inQuote.at(-1) ?? -1 };
    });
    const placed: Placed[] = [];
    // Each citation comes after the one before it, by word. The last link stays open to a split,
    // when the next verse's words begin inside its quote.
    let from = 0;
    // Where the last link ends: a reference goes after it, never inside.
    let linkedTo = 0;
    let last: { quote: number; first: number; verse: string[]; citation: Citation } | null = null;

    for (const c of cited) {
      const place = parseVerseId(c.verse);
      if (!place) continue;
      const verse = wordsOf(place.book, place.chapter, place.verse);
      const inVerse = (word: string) => verse.some((v) => same(v, word));

      const candidates: Candidate[] = [];
      quoteWords.forEach(({ first, last: end }, q) => {
        if (first < from || q === last?.quote) return;
        if (holds(verse, counted(first, end)))
          candidates.push({ first, last: end, placing: 'quote' });
      });
      // Two halves of one quote for one verse would be one link cut in two.
      if (last && last.citation.verse !== c.verse) {
        const { first: head, verse: before } = last;
        const end = quoteWords[last.quote].last;
        for (let w = Math.max(head + 1, from); w <= end; w++) {
          // Each half two words of its verse in a row: one word is too little to split on.
          const tail = counted(w, end);
          const rest = counted(head, w - 1);
          if (
            words[w].counts &&
            tail.length >= RUN &&
            rest.length >= RUN &&
            startsRun(verse, tail) &&
            holds(before, rest)
          ) {
            candidates.push({ first: w, last: end, placing: 'shared' });
            break;
          }
        }
      }
      for (let i = from; i + SURE_RUN <= words.length; i++) {
        const run = words.slice(i, i + SURE_RUN);
        if (run.some((w) => w.quote >= 0 || !w.counts)) continue;
        if (
          !startsRun(
            verse,
            run.map((w) => w.word),
            SURE_RUN,
          )
        )
          continue;
        let to = i + SURE_RUN - 1;
        while (to + 1 < words.length && words[to + 1].quote < 0 && inVerse(words[to + 1].word))
          to++;
        candidates.push({ first: i, last: to, placing: 'words' });
        break;
      }

      // Where the words after the reference are, words that hold less of the verse still do if they
      // share an uncommon word of it: a quote (״בל תכלה״ for לא תכלה), or two of its words outside
      // any quote (ויצרו וימנו).
      const uncommon = (word: string) => inVerse(word) && (versesWith.get(word) ?? 0) < COMMON;
      const nearAligned = (at: number): Candidate | undefined => {
        if (at < 0) return undefined;
        const soon = words.slice(at + 1, at + 3).find((w) => w.quote >= 0)?.quote ?? -1;
        const q = words[at].quote >= 0 ? words[at].quote : soon;
        if (q >= 0) {
          const { first, last: end } = quoteWords[q];
          return first >= from && q !== last?.quote && counted(first, end).some(uncommon)
            ? { first, last: end, placing: 'variant' }
            : undefined;
        }
        let to = at;
        while (to + 1 < words.length && words[to + 1].quote < 0 && inVerse(words[to + 1].word)) {
          to++;
        }
        const run = words.slice(at, to + 1).map((w) => w.word);
        return inVerse(words[at].word) && to > at && run.some(uncommon)
          ? { first: at, last: to, placing: 'variant' }
          : undefined;
      };
      const aligned = alignedWord(words, c, from);
      const opening = candidates.find((k) => k.placing === 'quote' && k.first <= 2);
      const chosen = c.carried
        ? opening && { ...opening, placing: 'next' as const }
        : (candidates.find(
            (k) =>
              aligned >= 0 &&
              k.first <= aligned + 2 &&
              aligned <= k.last &&
              // Words common to many verses, בני ישראל, cannot tell the one quoted from its neighbours.
              counted(k.first, k.last).some(uncommon),
          ) ??
          BY_PREFERENCE.flatMap((p) =>
            // A one-word quote, טוב, only where no longer one, כי טוב לו עמך, holds the verse.
            candidates
              .filter((k) => k.placing === p)
              .sort((a, b) => Number(a.first === a.last) - Number(b.first === b.last)),
          )[0] ??
          nearAligned(aligned));
      if (c.carried && !chosen) continue;
      if (
        !chosen &&
        placed.some((p) => p.cited.verse === c.verse && p.citation && !p.citation.reference)
      ) {
        placed.push({ citation: null, placing: 'again', cited: c });
        continue;
      }
      if (!chosen) {
        const next = words.findIndex((w) => w.start >= linkedTo);
        const at = referencePlace(
          text,
          words,
          quotes,
          c,
          next < 0 ? words.length : Math.max(from, next),
        );
        placed.push({
          citation: { start: at, end: at, verse: c.verse, reference: c.reference },
          placing: 'reference',
          cited: c,
        });
        // What it cites next comes after it.
        const after = words.findIndex((w) => w.start >= at);
        from = after < 0 ? words.length : after;
        linkedTo = at;
        last = null;
        continue;
      }
      const quote = words[chosen.first].quote;
      if (chosen.placing === 'shared') last!.citation.end = words[chosen.first - 1].end;
      const citation: Citation = {
        start:
          quote >= 0 && chosen.placing !== 'shared'
            ? quotes[quote].start
            : words[chosen.first].start,
        end: quote >= 0 ? quotes[quote].end : words[chosen.last].end,
        verse: c.verse,
      };
      placed.push({ citation, placing: chosen.placing, cited: c });
      from = chosen.first + 1;
      linkedTo = citation.end;
      last = quote >= 0 ? { quote, first: chosen.first, verse, citation } : null;
    }
    return placed;
  };
}

/** Whether quoted words hold a verse: two of its words in a row, or the one word quoted. */
function holds(verse: readonly string[], quoted: readonly string[]): boolean {
  return quoted.length > 0 && holdsRun(verse, quoted, Math.min(RUN, quoted.length), same);
}

/** Whether `quoted` begins with a run of the verse's words, of `count` or as many as it has. */
function startsRun(verse: readonly string[], quoted: readonly string[], count = RUN): boolean {
  const run = quoted.slice(0, count);
  return run.length > 0 && holdsRun(verse, run, run.length, same);
}

/**
 * Whether two words, as quotes are compared, are one: also when one has a prefix the other lacks,
 * as the Talmud's ממכה quotes the verse's ומכה, and its איתן the verse's לאיתן.
 */
function same(a: string, b: string): boolean {
  const unprefixed = (x: string, y: string) =>
    x.length > 3 && PREFIXES.includes(x[0]) && x.slice(1) === y;
  return a === b || unprefixed(a, b) || unprefixed(b, a);
}

// The letters Hebrew joins to the front of a word. ו and י are already gone from compared words.
const PREFIXES = 'בדהכלמש';

/** The word where the words that follow a reference begin, or -1. */
function alignedWord(words: readonly Word[], cited: Cited, from: number): number {
  // Three words where there are three, as two often recur: ויצחק בן ששים, not the יצחק בן ארבעים
  // before it. Wikisource joins a prefix to the quote it opens, לותמונת where Davidson has ל״ותמנת.
  const [first = '', ...rest] = cited.after;
  const prefixed = PREFIXES.includes(first[0]) ? [first.slice(1), ...rest] : [];
  const runs = [SURE_RUN, RUN]
    .flatMap((n) => [cited.after.slice(0, n), prefixed.slice(0, n)])
    .filter((run) => run.length > 0);
  // Where the word before the reference comes before the run too: the עור of להלן עור ובשר, not the
  // one of כאן עור ובשר.
  const before = cited.before.slice(-1);
  for (const run of before.length > 0 ? runs : []) {
    const at = findRun(words, [...before, ...run], from);
    if (at >= 0) return words.findIndex((w, i) => i > at && w.aligns);
  }
  return runs.map((run) => findRun(words, run, from)).find((at) => at >= 0) ?? -1;
}

/**
 * The index of the first word from `start` that begins a run of `run`, reading only the words that
 * count: a single letter or וגו׳ may stand in one edition and not the other.
 */
function findRun(words: readonly Word[], run: readonly string[], start: number): number {
  if (run.length === 0) return -1;
  const counted = words.flatMap((w, i) => (i >= start && w.aligns ? [i] : []));
  const at = counted.findIndex((_, i) =>
    run.every((word, k) => words[counted[i + k]]?.word === word),
  );
  return at < 0 ? -1 : counted[at];
}

/**
 * Where to show a reference: before the words that follow it, or after those before it, two in a
 * row at least; else at word `from`, where what it cited before ends. Never inside a quote's marks.
 */
function referencePlace(
  text: string,
  words: readonly Word[],
  quotes: readonly { start: number; end: number }[],
  cited: Cited,
  from: number,
): number {
  const following = alignedWord(words, cited, from);
  const before = cited.before.slice(-RUN);
  const preceding = before.length === RUN ? findRun(words, before, from) : -1;
  if (following < 0 && preceding >= 0) {
    const { end, quote } = words[preceding + RUN - 1] ?? words[preceding];
    return quote >= 0 && quotes[quote].end === end && text[end] === '״' ? end + 1 : end;
  }
  const word = words[following >= 0 ? following : from];
  if (!word) return text.length;
  const opensQuote = word.quote >= 0 && quotes[word.quote].start === word.start;
  return opensQuote && text[word.start - 1] === '״' ? word.start - 1 : word.start;
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
    const counted = counts(core[0]);
    words.push({
      start,
      end,
      word: compared(core[0]),
      counts: counted,
      aligns: counted && within(bracketed, start, end) < 0,
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
  /^[^א-ת]*(?:[בדכלמש][\u0591-\u05C7]*)?(?:ה[\u0591-\u05C7]*['׳]|י['"׳״]י)[^א-ת]*$/.test(written);

/** A written word as quotes and verses are compared: its letters, ה׳ or י״י read as the name. */
export function compared(written: string): string {
  return spelling(isName(written) ? 'יהוה' : letters(written));
}

function isNumbered(shape: RegExpMatchArray | null): boolean {
  return !!shape && hebrewNumber(shape[1]) !== null && hebrewNumber(shape[2]) !== null;
}

/** Whether a verse holds `count` of the words quoted, one after another. */
type Holds = (chapter: number, verse: number, count: number) => boolean;

/** The first words that follow a citation, as verses are compared; null when too few follow. */
function quote(after: string): string[] | null {
  const words: string[] = [];
  for (const written of after.split(/[([{]/)[0].split(/\s+/)) {
    if (letters(written) === 'וגו') continue;
    // Any abbreviation but the name ends the quote.
    if (!isName(written) && /['"׳״]/.test(written)) break;
    if (counts(written)) words.push(compared(written));
    if (words.length === SURE_RUN) break;
  }
  return words.length < SURE_RUN ? null : words;
}

function holdsRun(
  verseWords: readonly string[],
  quoted: readonly string[],
  count: number,
  same = (a: string, b: string) => a === b,
): boolean {
  return verseWords.some((_, at) =>
    quoted.some(
      (_, from) =>
        from + count <= quoted.length &&
        quoted.slice(from, from + count).every((word, i) => same(verseWords[at + i] ?? '', word)),
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
  if (holds && !(exists(verse) && holds(chapter, verse, RUN))) {
    for (let distance = 1; distance <= NEARBY; distance++) {
      for (const near of [verse - distance, verse + distance]) {
        if (exists(near) && holds(chapter, near, SURE_RUN))
          return verseId(book.name, chapter, near);
      }
    }
  }
  return exists(verse) ? verseId(book.name, chapter, verse) : null;
}

/**
 * The citations in a tractate's text, by amud and segment: the verses `find` reads in each segment
 * of `naming`, an edition that names them, placed in the same segment of `text`. Also every stretch
 * that looked like a citation but named no verse. Each citation's placing is counted in `placings`.
 */
export function citationsByPlace(
  text: readonly (readonly string[])[],
  naming: readonly (readonly string[])[],
  find: (text: string) => Found,
  place: ReturnType<typeof quoteFinder>,
  placings: Partial<Record<Placing, number>>,
): { citations: TalmudTractateText['citations']; missed: string[] } {
  const citations: TalmudTractateText['citations'] = {};
  const missed: string[] = [];
  const segments: { ai: number; si: number; placed: Placed[] }[] = [];
  let previous: Placed[] = [];
  text.forEach((amud, ai) =>
    amud.forEach((segment, si) => {
      const names = naming[ai]?.[si] ?? '';
      const found = find(names);
      missed.push(...found.missed);
      const cited: Cited[] = found.citations.map(({ start, end, verse }, i) => ({
        verse,
        reference: `(${names.slice(start, end).trim()})`,
        after: wordsBetween(names, end + 1, found.citations[i + 1]?.start ?? names.length),
        before: wordsBetween(names, found.citations[i - 1]?.end ?? 0, start - 1),
      }));
      // A reference that ends a segment, or for a word, may name a verse the next one opens on.
      const ending = (p: Placed) => p.placing === 'reference' && p.cited.after.length < RUN;
      const carried = previous.filter(ending).map((p) => ({ ...p.cited, carried: true }));
      const placed = place(segment, [...carried, ...cited]);
      for (const { cited: moved } of placed.filter((p) => p.placing === 'next')) {
        previous.splice(
          previous.findIndex((p) => ending(p) && p.cited.verse === moved.verse),
          1,
        );
      }
      segments.push({ ai, si, placed });
      previous = placed;
    }),
  );
  for (const { ai, si, placed } of segments) {
    for (const { placing } of placed) placings[placing] = (placings[placing] ?? 0) + 1;
    const shown = placed.flatMap(({ citation }) => (citation ? [citation] : []));
    if (shown.length > 0) (citations[ai] ??= {})[si] = shown;
  }
  return { citations, missed };
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
