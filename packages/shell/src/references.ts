// What every text's reference reader shares: breaking what was typed into
// tokens, and finding which book, tractate or part the tokens begin by naming.

import { isNikkud } from '@torahmap/hebrew';

/** A run of letters or of digits, and the full stop or colon right after it, if any. */
export interface Token {
  text: string;
  mark: '' | '.' | ':';
}

/** The token a dash becomes, between the two ends of a range. */
export const RANGE = '-';

// Dropped inside a token: geresh, gershayim and the quotes typed for them.
const JOINERS = /['"`’‘׳״]/g;
const SEPARATOR = /[\s,;()[\]/\\]/;
const DASH = /[-–—־]/;

/** `typed` lower-cased and broken into tokens, splitting where digits meet letters. */
export function referenceTokens(typed: string): Token[] {
  const clean = [...typed.normalize('NFC').toLowerCase().replace(JOINERS, '')]
    .filter((char) => !isNikkud(char.charCodeAt(0)))
    .join('');
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

const FINAL_LETTERS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3' };

/** A token's letters, final Hebrew letters written as plain ones. */
const plain = (text: string) => text.replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]);

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
  return tokens
    .map((text, i) => (i === 0 && tokens.length > 1 && ROMAN[text] ? ROMAN[text] : fold(text)))
    .join('');
}

const FOLDS = [plain, skeleton];

/** Something a reference can begin by naming, and every name it goes by. */
export interface Named<K> {
  key: K;
  names: readonly string[];
}

/**
 * Reads which entry tokens begin by naming, and the tokens after its name.
 *
 * The longest run of tokens that names something wins, so the א of שמואל א
 * is part of the book rather than its chapter. A name is matched as written,
 * then as it sounds; at each, a whole name beats the start of one, and the
 * start of several names is no name.
 */
export function nameReader<K>(
  entries: readonly Named<K>[],
): (tokens: readonly Token[]) => { key: K; rest: Token[] } | null {
  const folded = FOLDS.map((fold) =>
    entries.map(({ key, names }) => ({
      key,
      names: names.map((name) => joined(texts(referenceTokens(name)), fold)),
    })),
  );

  function named(words: readonly string[]): K | null {
    for (const [i, fold] of FOLDS.entries()) {
      const typed = joined(words, fold);
      const whole = keysWhere(folded[i], (name) => name === typed);
      if (whole.length === 1) return whole[0];
      const starts = keysWhere(folded[i], (name) => name.startsWith(typed));
      if (starts.length === 1) return starts[0];
      if (whole.length + starts.length > 0) return null;
    }
    return null;
  }

  return (tokens) => {
    for (let k = tokens.length; k > 0; k--) {
      const words = texts(tokens.slice(0, k));
      if (words.includes(RANGE) || letterCount(words) < 2) continue;
      const key = named(words);
      if (key !== null) return { key, rest: tokens.slice(k) };
    }
    return null;
  };
}

const COMPLETIONS = 6;

/**
 * The names `typed` is the start of, one per entry and at most a handful, to
 * finish it with. An entry already named in full is offered no longer.
 */
export function nameCompleter<K>(entries: readonly Named<K>[]): (typed: string) => string[] {
  const folded = entries.map(({ names }) =>
    names.map((name) => ({ name, fold: joined(texts(referenceTokens(name)), plain) })),
  );
  return (typed) => {
    const words = texts(referenceTokens(typed));
    if (words.length === 0) return [];
    // A Roman numeral alone may be the start of a numbered book.
    const roman = words.length === 1 ? ROMAN[words[0]] : undefined;
    const starts = [joined(words, plain), ...(roman ? [roman] : [])];
    const offered: string[] = [];
    for (const names of folded) {
      if (names.some(({ fold }) => fold === starts[0])) continue;
      const hit = names.find(({ fold }) => starts.some((start) => fold.startsWith(start)));
      if (hit) offered.push(hit.name);
    }
    return offered.slice(0, COMPLETIONS);
  };
}

const texts = (tokens: readonly Token[]) => tokens.map((t) => t.text);
const letterCount = (words: readonly string[]) => words.join('').replace(/[^\p{L}]/gu, '').length;

function keysWhere<K>(entries: readonly Named<K>[], test: (name: string) => boolean): K[] {
  return [...new Set(entries.filter((e) => e.names.some(test)).map((e) => e.key))];
}
