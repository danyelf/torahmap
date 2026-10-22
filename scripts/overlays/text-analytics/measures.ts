/**
 * The Text analytics overlay's two measures, each a score per verse:
 *
 * - Repetitive wording: the share of the words around a verse that sit in a
 *   three-word run its own book repeats nearby.
 * - Common and rare trop: how unusual the way the verses around it are divided
 *   by their pauses is, against verses of the same length.
 *
 * Both are averaged over a window of verses within the book, and neither
 * scores a short verse.
 */

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

/** These three books use a different set of marks, which the pause ranks below do not describe. */
export const POETIC_BOOKS: ReadonlySet<string> = new Set(['Psalms', 'Proverbs', 'Job']);

/** A book's verses in reading order, each its Hebrew text. */
export interface Book {
  name: string;
  verses: string[];
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
const HEBREW_LETTER = /[\u05d0-\u05ea]/;
// Sefaria writes a word read differently from its spelling as (written) [read].
const WRITTEN_FORM = /\([^)]*\)/g;

// The disjunctive accents of the prose books by rank, strongest first. A verse
// divides first at its rank-1 pause, each piece then at its strongest rank, and
// so on; the end of the verse (silluq) outranks them all.
const PAUSES: Record<string, { name: string; rank: number }> = {
  '\u0591': { name: 'etnachta', rank: 1 },
  '\u0592': { name: 'segol', rank: 2 },
  '\u0593': { name: 'shalshelet', rank: 2 },
  '\u0594': { name: 'zaqef-qatan', rank: 2 },
  '\u0595': { name: 'zaqef-gadol', rank: 2 },
  '\u0596': { name: 'tipcha', rank: 2 },
  '\u0597': { name: 'revia', rank: 3 },
  // Zarqa is written with either code point.
  '\u0598': { name: 'zarqa', rank: 3 },
  '\u05ae': { name: 'zarqa', rank: 3 },
  '\u0599': { name: 'pashta', rank: 3 },
  '\u059a': { name: 'yetiv', rank: 3 },
  '\u059b': { name: 'tevir', rank: 3 },
  '\u059c': { name: 'geresh', rank: 4 },
  '\u059d': { name: 'geresh', rank: 4 },
  '\u059e': { name: 'gershayim', rank: 4 },
  '\u059f': { name: 'karnei-parah', rank: 4 },
  '\u05a0': { name: 'telisha-gedola', rank: 4 },
  '\u05a1': { name: 'pazer', rank: 4 },
};
const LEGARMEH = { name: 'legarmeh', rank: 4 };
const RANK = new Map(Object.values(PAUSES).map((p) => [p.name, p.rank]));
RANK.set(LEGARMEH.name, LEGARMEH.rank);

/** The words of a verse, each with its consonants and strongest pause. */
export function units(he: string): Unit[] {
  const tokens = he
    .replace(WRITTEN_FORM, ' ')
    .split(PASEQ)
    .join(` ${PASEQ} `)
    .split(/[\s\u05c3]+/);
  const result: Unit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!HEBREW_LETTER.test(token) || token.startsWith('{')) continue;
    let consonants = '';
    let best: { name: string; rank: number } | null = null;
    for (const ch of token) {
      if (HEBREW_LETTER.test(ch) || ch === MAQAF) consonants += ch;
      const pause = PAUSES[ch];
      if (pause && (!best || pause.rank < best.rank)) best = pause;
    }
    if (!best && token.includes(MUNACH) && tokens[i + 1] === PASEQ) best = LEGARMEH;
    result.push({ consonants, pause: best?.name ?? null });
  }
  return result;
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
const wordsOf = (books: Book[]): string[][][] =>
  books.map((b) => b.verses.map((v) => units(v).map((u) => u.consonants)));

/** The runs a verse holds, in order. */
const runsIn = (verse: string[]): string[] =>
  Array.from({ length: Math.max(0, verse.length - RUN_WORDS + 1) }, (_, p) =>
    verse.slice(p, p + RUN_WORDS).join(' '),
  );

/** The runs found in enough books to be stock phrases. */
export function formulas(books: Book[]): Set<string> {
  const booksWith = new Map<string, Set<number>>();
  wordsOf(books).forEach((verses, b) =>
    verses.forEach((verse) =>
      runsIn(verse).forEach((run) => {
        if (!booksWith.has(run)) booksWith.set(run, new Set());
        booksWith.get(run)!.add(b);
      }),
    ),
  );
  return new Set([...booksWith].filter(([, b]) => b.size >= FORMULA_BOOKS).map(([run]) => run));
}

/** Each book's repetitive-wording scores, parallel to `books`. */
export function repetitionScores(books: Book[]): BookScores[] {
  const stock = formulas(books);
  return wordsOf(books).map((verses) => {
    // Where each run is found in the book.
    const at = new Map<string, { verse: number; position: number }[]>();
    verses.forEach((verse, v) =>
      runsIn(verse).forEach((run, position) => {
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
          (other) => other !== place && Math.abs(other.verse - place.verse) <= REACH_VERSES,
        );
        if (!recurs) continue;
        for (let k = 0; k < RUN_WORDS; k++) repeated[place.verse][place.position + k] = true;
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
   * The pause the piece ends on; `verse` for the whole verse. The last piece
   * of a split ends where the piece it came from ends, so it is named by that
   * pause and the rank it was split at, as `silluq:1` for the second half of a
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
    result.push({ kind, way: at.map((i) => verse[i].pause).join(' ') });
    let start = from;
    for (const i of at) {
      split(start, i, verse[i].pause!, verse[i].pause!);
      start = i + 1;
    }
    if (at.length) split(start, to, `${end}:${strongest}`, end);
  };
  if (verse.length) split(0, verse.length - 1, 'verse', 'silluq');
  return result;
}

/** Each book's common-and-rare-trop scores, in bits, parallel to `books`. */
export function tropScores(books: Book[]): BookScores[] {
  const parsed = books.map((b) =>
    POETIC_BOOKS.has(b.name)
      ? b.verses.map(() => null)
      : b.verses.map((v) => {
          const verse = units(v);
          return verse.length >= MIN_WORDS ? { length: verse.length, pieces: pieces(verse) } : null;
        }),
  );
  const all = parsed.flat().filter((v) => v !== null);

  // How often each kind of piece is split each way, across every scored verse.
  const counts = new Map<string, Map<string, number>>();
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
  const cost = new Map(all.map((v) => [v, v.pieces.reduce((sum, p) => sum + bits(p), 0)]));
  const expected = new Map<number, { cost: number; pieces: number }>();
  const expectedFor = (length: number): { cost: number; pieces: number } => {
    let found = expected.get(length);
    if (!found) {
      const near = all.filter((v) => Math.abs(v.length - length) <= LENGTH_MATCH * length);
      found = {
        cost: near.reduce((sum, v) => sum + cost.get(v)!, 0) / near.length,
        pieces: near.reduce((sum, v) => sum + v.pieces.length, 0) / near.length,
      };
      expected.set(length, found);
    }
    return found;
  };

  return parsed.map((verses) => {
    const sum = (f: (v: NonNullable<(typeof verses)[number]>) => number) =>
      prefixSums(verses.map((v) => (v ? f(v) : 0)));
    const actualCost = sum((v) => cost.get(v)!);
    const actualPieces = sum((v) => v.pieces.length);
    const baseCost = sum((v) => expectedFor(v.length).cost);
    const basePieces = sum((v) => expectedFor(v.length).pieces);
    return windowed(
      verses.length,
      (i) => verses[i] !== null,
      (from, to) =>
        actualCost(from, to) / actualPieces(from, to) - baseCost(from, to) / basePieces(from, to),
    );
  });
}
