// What every text's reference reader shares: breaking what was typed into
// tokens, and finding which book, tractate or part the tokens begin by naming.

import { foldFinalLetters, hebrewNumber, withoutPointsOrGeresh } from '@torahmap/hebrew';

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

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' };

const plain = foldFinalLetters;

/**
 * A token as it sounds rather than as it is spelled: the transliterations of
 * one Hebrew letter written alike, a closing -ah or -s dropped or written as -t,
 * vowels after the first letter gone, and doubled letters single.
 */
function skeleton(text: string): string {
  const sounds = plain(text)
    .replace(/kh|ch/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/tz|ts/g, 'z')
    .replace(/[qc]/g, 'k')
    .replace(/[vw]/g, 'b')
    .replace(/ah$/, 'a')
    .replace(/s$/, 't');
  const consonants = sounds[0] + sounds.slice(1).replace(/[aeiouוי]/g, '');
  return consonants.replace(/(.)\1+/g, '$1');
}

/** Tokens written as one name, a leading Roman numeral read as its number. */
function joined(tokens: readonly string[], fold: (text: string) => string): string {
  return tokens.map((text, i) => (i === 0 && ROMAN[text] ? ROMAN[text] : fold(text))).join('');
}

const FOLDS = [plain, skeleton];

/** Something a reference can begin by naming, and every name it goes by. */
export interface Named<K> {
  key: K;
  names: readonly string[];
}

const COMPLETIONS = 6;

/**
 * Every name of `entries`, written once as each fold writes it, to read and
 * to complete from.
 *
 * Reading takes the longest run of tokens that names something, so the א of
 * שמואל א is part of the book rather than its chapter. A name is matched as
 * written, then as it sounds; at each, a whole name beats the start of one,
 * and the start of several names is no name. Completing goes by names as
 * written.
 */
export function nameTable<K>(entries: readonly Named<K>[]): {
  /** The entry `tokens` begin by naming, and the tokens after its name. */
  read(tokens: readonly Token[]): { key: K; rest: Token[] } | null;
  /** The names `typed` is the start of, one per entry and at most a handful. */
  complete(typed: string): string[];
} {
  const table = entries.map(({ key, names }) => ({
    key,
    names: names.map((name) => {
      const words = texts(referenceTokens(name));
      return { name, folds: FOLDS.map((fold) => joined(words, fold)) };
    }),
  }));

  /** The keys with a name that, as fold `i` writes it, passes `test`. */
  const keysWhere = (i: number, test: (name: string) => boolean): K[] => [
    ...new Set(table.filter((e) => e.names.some((n) => test(n.folds[i]))).map((e) => e.key)),
  ];

  function named(words: readonly string[]): K | null {
    for (const [i, fold] of FOLDS.entries()) {
      const typed = joined(words, fold);
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
      const start = joined(words, FOLDS[0]);
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

const texts = (tokens: readonly Token[]) => tokens.map((t) => t.text);
const letterCount = (words: readonly string[]) => words.join('').replace(/[^\p{L}]/gu, '').length;
