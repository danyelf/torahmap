// What every text's reference reader shares: breaking what was typed into
// tokens, and finding what the tokens begin by naming.

import { hebrewNumber, withoutPointsOrGeresh } from '@torahmap/hebrew';
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
  // Geresh and gershayim join the letters either side, as in ע״א.
  const clean = withoutPointsOrGeresh(typed.normalize('NFC').toLowerCase());
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

/** A token's number, in digits or Hebrew letters; null for anything else. */
export function numberIn(token: Token): number | null {
  if (/^\d+$/.test(token.text)) return Number(token.text);
  return hebrewNumber(token.text);
}

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
  names: readonly string[];
}

const COMPLETIONS = 6;

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
): {
  /** The entry `tokens` begin by naming, and the tokens after its name. */
  read(tokens: readonly Token[]): { key: K; rest: Token[] } | null;
  /** The names `typed` is the start of, one per entry and at most a handful. */
  complete(typed: string): string[];
} {
  const table = entries.map(({ key, names }) => ({
    key,
    names: names.map((name) => {
      const words = texts(referenceTokens(name));
      return { name, folds: folds.map((fold) => fold(words)) };
    }),
  }));

  /** The keys with a name that, as fold `i` writes it, passes `test`. */
  const keysWhere = (i: number, test: (name: string) => boolean): K[] => [
    ...new Set(table.filter((e) => e.names.some((n) => test(n.folds[i]))).map((e) => e.key)),
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
      const words = texts(referenceTokens(typed));
      if (words.length === 0) return [];
      const start = folds[0](words);
      const offered: string[] = [];
      for (const { names } of table) {
        if (names.some((n) => n.folds[0] === start)) continue;
        const hit = names.find((n) => n.folds[0].startsWith(start));
        if (hit) offered.push(hit.name);
      }
      return offered.slice(0, COMPLETIONS);
    },
  };
}

/** Each of `items`, named by its name, its name in Hebrew and any `others` listed under its name. */
export function byNames<T extends { name: string; hebrewName: string }>(
  items: readonly T[],
  others: Readonly<Record<string, readonly string[]>>,
): Named<T>[] {
  return items.map((item) => ({
    key: item,
    names: [item.name, item.hebrewName, ...(others[item.name] ?? [])],
  }));
}

/** How a text reads a reference: what one may begin by naming, and what may follow the name. */
export interface Reading<K> {
  named: readonly Named<K>[];
  folds?: readonly Fold[];
  /** Words that may follow the name and say nothing. */
  filler?: ReadonlySet<string>;
  /** The place the tokens after `key`'s name give, its filler gone. */
  place(key: K, rest: Token[]): Reference | null;
  /** The place tokens that begin with no name give. */
  unnamed?(tokens: Token[]): Reference | null;
}

export function referenceReader<K>(how: Reading<K>): Omit<GoTo, 'examples'> {
  const names = nameTable(how.named, how.folds);
  return {
    read(typed) {
      const tokens = referenceTokens(typed);
      const found = names.read(tokens);
      if (!found) return how.unnamed?.(tokens) ?? null;
      return how.place(
        found.key,
        found.rest.filter((t) => !how.filler?.has(t.text)),
      );
    },
    complete: names.complete,
  };
}

const texts = (tokens: readonly Token[]) => tokens.map((t) => t.text);
const letterCount = (words: readonly string[]) => words.join('').replace(/[^\p{L}]/gu, '').length;
