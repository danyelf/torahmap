// What every text's reference reader shares: breaking what was typed into
// tokens, and finding what the tokens begin by naming.

import type { GoTo, Reference } from './app/text.ts';

/** A run of letters or of digits, and the full stop or colon right after it, if any. */
export interface Token {
  text: string;
  mark: '' | '.' | ':';
}

/** The token a dash becomes, between the two ends of a range. */
export const RANGE = '-';

const SEPARATOR = /[\s,;()[\]/\\]/;
const DASH = /[-–—־]/;

/** `typed` lower-cased and broken into tokens, splitting where digits meet letters. */
export function referenceTokens(typed: string): Token[] {
  const clean = typed.normalize('NFC').toLowerCase();
  const tokens: Token[] = [];
  let run = '';
  const end = (mark: Token['mark'] = '') => {
    if (run) tokens.push({ text: run, mark });
    run = '';
  };
  for (const char of clean) {
    if (char === '.' || char === ':') end(char);
    else if (SEPARATOR.test(char)) end();
    else if (DASH.test(char)) {
      end();
      tokens.push({ text: RANGE, mark: '' });
    } else {
      if (run && isDigit(run[run.length - 1]) !== isDigit(char)) end();
      run += char;
    }
  }
  end();
  return tokens;
}

const isDigit = (char: string) => char >= '0' && char <= '9';

/** A text written as it is to be read. */
export type Clean = (text: string) => string;

/** How a name's words are written for matching, so that spellings of one name come out alike. */
export type Fold = (words: readonly string[]) => string;

/** A fold that writes each word with `fold` and joins them. */
export const eachWord =
  (fold: (word: string) => string): Fold =>
  (words) =>
    words.map(fold).join('');

/** Words joined as written, lower-cased as every token is. */
const AS_WRITTEN = eachWord((word) => word);

/** Something a reference can begin by naming, and every name it goes by. */
export interface Named<K> {
  key: K;
  /** Every name, in the order to offer them; the first fold matches each as written. */
  names: readonly string[];
  /** Those of `names` readers spell in more than one way, which the later folds match too. */
  spellings?: readonly string[];
}

/** `key` named by each group of names in order; the groups marked `spelled` are its spellings. */
export function namedBy<K>(
  key: K,
  groups: readonly { names: readonly string[] | undefined; spelled?: boolean }[],
): Named<K> {
  return {
    key,
    names: groups.flatMap((g) => g.names ?? []),
    spellings: groups.flatMap((g) => (g.spelled ? (g.names ?? []) : [])),
  };
}

/**
 * Every name of `entries`, written once by each of `folds`, to read and to
 * complete from.
 *
 * Reading takes the longest run of tokens that names something, so a name of
 * several words is not cut short by a shorter name inside it. It tries the
 * folds in turn; at each, a whole name beats the start of one, and the start
 * of several names is no name. Completing goes by the first fold.
 */
export function nameTable<K>(
  entries: readonly Named<K>[],
  folds: readonly Fold[] = [AS_WRITTEN],
  clean: Clean = (text) => text,
): {
  /** The entry `tokens` begin by naming, and the tokens after its name. */
  read(tokens: readonly Token[]): { key: K; rest: Token[] } | null;
  /** The names `typed` is the start of, or of a later word of, one per entry, in order. */
  complete(typed: string): string[];
} {
  const table = entries.map(({ key, names, spellings = [] }) => ({
    key,
    names: names.map((name) => {
      const words = texts(referenceTokens(clean(name)));
      const spelled = spellings.includes(name);
      return {
        name,
        // A later fold writes nothing for a name matched only as written.
        folds: folds.map((fold, i) => (i === 0 || spelled ? fold(words) : null)),
        // Where completion may start: the name, and the rest of it from each later word.
        starts: words.map((_, i) => folds[0](words.slice(i))),
      };
    }),
  }));

  /** The keys with a name that, as fold `i` writes it, passes `test`. */
  const keysWhere = (i: number, test: (name: string) => boolean): K[] => [
    ...new Set(
      table
        .filter((e) => e.names.some((n) => n.folds[i] !== null && test(n.folds[i])))
        .map((e) => e.key),
    ),
  ];

  function named(words: readonly string[]): K | null {
    for (const [i, fold] of folds.entries()) {
      const typed = fold(words);
      const whole = keysWhere(i, (name) => name === typed);
      if (whole.length === 1) return whole[0];
      const starts = keysWhere(i, (name) => name.startsWith(typed));
      if (starts.length === 1) return starts[0];
      if (whole.length + starts.length > 0) return null;
    }
    return null;
  }

  return {
    read(tokens) {
      for (let k = tokens.length; k > 0; k--) {
        const words = texts(tokens.slice(0, k));
        if (words.includes(RANGE) || letterCount(words) < 2) continue;
        const key = named(words);
        if (key !== null) return { key, rest: tokens.slice(k) };
      }
      return null;
    },
    // An entry already named in full is offered no longer.
    complete(typed) {
      const words = texts(referenceTokens(clean(typed)));
      if (words.length === 0) return [];
      const start = folds[0](words);
      const offered: string[] = [];
      for (const { names } of table) {
        if (names.some((n) => n.folds[0] === start)) continue;
        const hit = names.find((n) => n.starts.some((from) => from.startsWith(start)));
        if (hit) offered.push(hit.name);
      }
      return offered;
    },
  };
}

/** How a text reads a reference: what one may begin by naming, and what may follow the name. */
export interface Reading<K> {
  named: readonly Named<K>[];
  folds?: readonly Fold[];
  /** What a reference typed, and a name, are written as before they are read: marks dropped, say. */
  clean?: Clean;
  /** Words that may follow the name and say nothing. */
  filler?: ReadonlySet<string>;
  /** The place the tokens after `key`'s name give, its filler gone. */
  place(key: K, rest: Token[]): Reference | null;
  /** The place tokens that begin with no name give. */
  unnamed?(tokens: Token[]): Reference | null;
}

/** Reads a reference as `how` says, and completes the names it reads from. */
export function referenceReader<K>(how: Reading<K>): {
  read: GoTo['read'];
  completeNames: GoTo['complete'];
} {
  const names = nameTable(how.named, how.folds, how.clean);
  return {
    read(typed) {
      const tokens = referenceTokens(how.clean?.(typed) ?? typed);
      const found = names.read(tokens);
      if (!found) return how.unnamed?.(tokens) ?? null;
      return how.place(
        found.key,
        found.rest.filter((t) => !how.filler?.has(t.text)),
      );
    },
    completeNames: names.complete,
  };
}

/**
 * Completes from `places`: those each of whose words starts as the typed
 * word in its place does, in the order given, leaving out one typed in full.
 */
export function placeCompleter(places: readonly string[]): GoTo['complete'] {
  const worded = places.map((place) => ({ place, words: texts(referenceTokens(place)) }));
  return (typed) => {
    const typedWords = texts(referenceTokens(typed));
    if (typedWords.length === 0) return [];
    return worded
      .filter(
        ({ words }) =>
          typedWords.length <= words.length &&
          typedWords.every((word, i) => words[i].startsWith(word)) &&
          words.join(' ') !== typedWords.join(' '),
      )
      .map(({ place }) => place);
  };
}

const texts = (tokens: readonly Token[]) => tokens.map((t) => t.text);
const letterCount = (words: readonly string[]) => words.join('').replace(/[^\p{L}]/gu, '').length;
