/**
 * The Text analytics overlay's two measures, each a score per verse:
 *
 * - Repetitive wording: the share of the words around a verse that sit in a
 *   three-word run its own book repeats nearby.
 * - Unusual verse division: how unusual the way the verses around it are
 *   divided by their pauses is, against verses of the same length.
 *
 * Both are averaged over a window of verses within the book, and neither
 * scores a short verse.
 *
 * Both count a maqaf-joined group as one word: it carries one accent, so it is
 * the unit a verse is divided into, and the unit a repeated run is made of.
 */

import { withoutKetiv, wordsBhsaParsed } from '@torahmap/tanakh/search/dictionary.ts';
import { TROP_MARKS } from '@torahmap/tanakh/overlays/trop/marks.ts';
import type {
  DivisionExample,
  ScoreParameters,
} from '@torahmap/tanakh/overlays/text-analytics/scores.ts';
import { isHebrew } from '@torahmap/hebrew';

/** The verses a score is averaged over, centred on the verse: a passage rather than a single verse. */
export const WINDOW_VERSES = 11;

/** Verses shorter than this get no score: short list items (Ezra 2) otherwise dominate both maps. */
export const MIN_WORDS = 7;

/** Words in a repeated run. */
export const RUN_WORDS = 3;

/**
 * How far apart, in verses of the same book, a run may recur and still count:
 * near enough to catch a passage repeating itself (Numbers 7's cycle of six
 * verses), not so far as to reach distant parallels.
 */
export const REACH_VERSES = 50;

/** A run found in this many books is a stock phrase ("and the LORD said to"), not a passage repeating itself. */
export const FORMULA_BOOKS = 5;

/** A verse is compared with verses whose length is within this share of its own. */
export const LENGTH_MATCH = 0.1;

/**
 * A piece whose way of splitting costs less than this has no real choice to make,
 * such as the stretch after a piece's last pause, and is left out of the
 * average. No piece costs between this and 0.15 bits, so the cutoff is a gap
 * in the data rather than a tuned value; leaving them out changes the map
 * little (rank correlation 0.97) and spreads its numbers.
 */
export const CERTAIN_BITS = 0.05;

/** These three books use a different set of marks, which the ranks in TROP_MARKS do not describe. */
export const POETIC_BOOKS: readonly string[] = ['Psalms', 'Proverbs', 'Job'];

/** Every value above that a reader is told, as the scores file records them. */
export const PARAMETERS: ScoreParameters = {
  windowVerses: WINDOW_VERSES,
  minWords: MIN_WORDS,
  runWords: RUN_WORDS,
  reachVerses: REACH_VERSES,
  formulaBooks: FORMULA_BOOKS,
  poeticBooks: [...POETIC_BOOKS],
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

/** A word as both measures read it: a maqaf-joined group counts as one. */
export interface Unit {
  /** Letters and maqaf only, so that two spellings with different points match. */
  consonants: string;
  /** The strongest pause the word carries, or null for none. */
  pause: string | null;
}

const MAQAF = '\u05be';
const PASEQ = '\u05c0';
const MUNACH = '\u05a3';

interface Pause {
  name: string;
  rank: number;
}

const PAUSES = new Map<string, Pause>(
  TROP_MARKS.flatMap((m) => (m.rank ? [[m.unicode, { name: m.name, rank: m.rank }] as const] : [])),
);
// Not a mark of its own: a munach followed by a paseq.
const LEGARMEH: Pause = { name: 'Legarmeh', rank: 4 };
const RANK = new Map([...PAUSES.values(), LEGARMEH].map((p) => [p.name, p.rank]));

/** The words of a verse, each with its consonants and strongest pause. */
export function units(he: string): Unit[] {
  const words = wordsBhsaParsed(he);
  // A maqaf joins the word read aloud, so it is looked for with the ketiv
  // blanked and the brackets around the qere set aside.
  const read = withoutKetiv(he);
  const joinedByMaqaf = (from: number, to: number): boolean =>
    read.slice(from, to).replace(/[\s[\]]/g, '') === MAQAF;
  const result: Unit[] = [];
  words.forEach(({ word, start, end }, i) => {
    let pause: Pause | null = null;
    for (const ch of word) {
      const p = PAUSES.get(ch);
      if (p && (!pause || p.rank < pause.rank)) pause = p;
    }
    const after = he.slice(end, words[i + 1]?.start ?? he.length);
    if (!pause && word.includes(MUNACH) && after.includes(PASEQ)) pause = LEGARMEH;
    const consonants = [...word].filter(isHebrew).join('');

    const joined = i > 0 && joinedByMaqaf(words[i - 1].end, start);
    const last = result[result.length - 1];
    if (joined && last) {
      last.consonants += MAQAF + consonants;
      if (pause && (!last.pause || pause.rank < RANK.get(last.pause)!)) last.pause = pause.name;
    } else {
      result.push({ consonants, pause: pause?.name ?? null });
    }
  });
  return result;
}

export function parse(book: Book): ParsedBook {
  return { name: book.name, verses: book.verses.map(units) };
}

/** `ratio` over the window around each verse that `scored` keeps; null for the rest. */
function windowed(
  count: number,
  scored: (i: number) => boolean,
  ratio: (from: number, to: number) => number,
): BookScores {
  const half = (WINDOW_VERSES - 1) / 2;
  return Array.from({ length: count }, (_, i) =>
    scored(i) ? ratio(Math.max(0, i - half), Math.min(count - 1, i + half)) : null,
  );
}

/** Prefix sums, so that a window's total is two lookups. */
function prefixSums(values: number[]): (from: number, to: number) => number {
  const sums = [0];
  for (const v of values) sums.push(sums[sums.length - 1] + v);
  return (from, to) => sums[to + 1] - sums[from];
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

    const total = prefixSums(verses.map((v) => v.length));
    const marked = prefixSums(repeated.map((v) => v.filter(Boolean).length));
    return windowed(
      verses.length,
      (i) => verses[i].length >= MIN_WORDS,
      (from, to) => marked(from, to) / total(from, to),
    );
  });
}

/** A piece of a verse: named by the pause it ends on, and how it is split. */
export interface Piece {
  /**
   * The pause the piece ends on; `Verse` for the whole verse. The last piece
   * of a split ends where the piece it came from ends, so it is named by that
   * pause and the rank it was split at, as `Silluq:1` for the second half of a
   * verse: what follows a verse's last pause is not the whole verse.
   */
  kind: string;
  /** The pauses it splits at, in order; empty when it holds no pause. */
  way: string;
}

/** Every piece of a verse, the whole verse first, each piece before the pieces it splits into. */
export function pieces(verse: Unit[]): Piece[] {
  const result: Piece[] = [];
  const split = (from: number, to: number, kind: string, end: string): void => {
    let strongest = Infinity;
    for (let i = from; i < to; i++) {
      const pause = verse[i].pause;
      if (pause) strongest = Math.min(strongest, RANK.get(pause)!);
    }
    const at: number[] = [];
    for (let i = from; i < to; i++) {
      const pause = verse[i].pause;
      if (pause && RANK.get(pause) === strongest) at.push(i);
    }
    result.push({ kind, way: at.map((i) => verse[i].pause).join(', ') });
    let start = from;
    for (const i of at) {
      split(start, i, verse[i].pause!, verse[i].pause!);
      start = i + 1;
    }
    if (at.length) split(start, to, `${end}:${strongest}`, end);
  };
  if (verse.length) split(0, verse.length - 1, 'Verse', 'Silluq');
  return result;
}

/** How often each kind of piece is split each way: kind → way → count. */
export type PieceCounts = Map<string, Map<string, number>>;

/**
 * Each book's unusual-verse-division scores, in bits, parallel to `books`; and
 * the counts the bits come from.
 */
export function divisionScores(
  books: ParsedBook[],
  certain = CERTAIN_BITS,
): {
  scores: BookScores[];
  counts: PieceCounts;
  /** How many pieces a verse's score counts, on average. */
  piecesPerVerse: number;
} {
  const parsed = books.map((b) =>
    POETIC_BOOKS.includes(b.name)
      ? b.verses.map(() => null)
      : b.verses.map((verse) =>
          verse.length >= MIN_WORDS ? { length: verse.length, pieces: pieces(verse) } : null,
        ),
  );
  const all = parsed.flat().filter((v) => v !== null);

  const counts: PieceCounts = new Map();
  for (const { pieces } of all) {
    for (const { kind, way } of pieces) {
      if (!counts.has(kind)) counts.set(kind, new Map());
      const ways = counts.get(kind)!;
      ways.set(way, (ways.get(way) ?? 0) + 1);
    }
  }
  const bits = (piece: Piece): number => {
    const ways = counts.get(piece.kind)!;
    let total = 0;
    for (const n of ways.values()) total += n;
    return -Math.log2(ways.get(piece.way)! / total);
  };

  // A verse's total cost and piece count; and, for each length, the average of
  // both over the verses near that length, which is what a verse is measured against.
  // The pieces that count: those whose way of splitting costs at least `certain` bits.
  const counted = new Map(all.map((v) => [v, v.pieces.filter((p) => bits(p) >= certain)]));
  const cost = new Map(all.map((v) => [v, counted.get(v)!.reduce((sum, p) => sum + bits(p), 0)]));
  const expected = new Map<number, { cost: number; pieces: number }>();
  const expectedFor = (length: number): { cost: number; pieces: number } => {
    let found = expected.get(length);
    if (!found) {
      const near = all.filter((v) => Math.abs(v.length - length) <= LENGTH_MATCH * length);
      found = {
        cost: near.reduce((sum, v) => sum + cost.get(v)!, 0) / near.length,
        pieces: near.reduce((sum, v) => sum + counted.get(v)!.length, 0) / near.length,
      };
      expected.set(length, found);
    }
    return found;
  };

  const scores = parsed.map((verses) => {
    const sum = (f: (v: NonNullable<(typeof verses)[number]>) => number) =>
      prefixSums(verses.map((v) => (v ? f(v) : 0)));
    const actualCost = sum((v) => cost.get(v)!);
    const actualPieces = sum((v) => counted.get(v)!.length);
    const baseCost = sum((v) => expectedFor(v.length).cost);
    const basePieces = sum((v) => expectedFor(v.length).pieces);
    return windowed(
      verses.length,
      (i) => verses[i] !== null,
      (from, to) =>
        actualCost(from, to) / actualPieces(from, to) - baseCost(from, to) / basePieces(from, to),
    );
  });
  const piecesPerVerse = all.reduce((sum, v) => sum + counted.get(v)!.length, 0) / all.length;
  return { scores, counts, piecesPerVerse };
}

// Vowel points, dagesh, meteg and the shin and sin dots: what is left is the
// letters, the trop, maqaf and sof pasuq.
const POINTS = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;

/**
 * A verse showing how its first half is divided: its words unvowelled with
 * their trop, the etnachta and the first half's strongest pauses named, and
 * the share of first halves divided the same way.
 */
export function divisionExample(
  ref: string,
  he: string,
  counts: PieceCounts,
  common: boolean,
): DivisionExample {
  const verse = units(he);
  const words = withoutKetiv(he)
    .replace(/<[^>]*>|\{[פס]\}|[[\]]/g, '')
    .split(/\s+/)
    .filter((w) => isHebrew(w) && w !== PASEQ);
  if (words.length !== verse.length) throw new Error(`${ref}: words and units do not line up`);
  const etnachta = verse.findIndex((u) => u.pause === 'Etnachta');
  const first = pieces(verse).find((p) => p.kind === 'Etnachta');
  if (etnachta < 0 || !first) throw new Error(`${ref} has no etnachta`);
  const ways = counts.get('Etnachta')!;
  const total = [...ways.values()].reduce((sum, n) => sum + n, 0);
  const dividers = new Set(first.way.split(', '));
  return {
    ref,
    common,
    share: (ways.get(first.way) ?? 0) / total,
    words: words.map((w, i) => {
      const text = w.replace(POINTS, '');
      const pause = verse[i].pause;
      if (i === etnachta) return { text, mark: 'Etnachta' };
      if (i > etnachta) return { text, secondHalf: true };
      return pause && dividers.has(pause) ? { text, mark: pause } : { text };
    }),
  };
}
