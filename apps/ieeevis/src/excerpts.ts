// The part of a piece's text the popup shows: the words around a search hit, or a short
// default when nothing is searched.

import { memoByValue } from '@torahmap/utils';
import type { TextRange } from '@torahmap/utils';
import type { PaperTexts } from './data.ts';

/** Words kept on each side of the hits. */
export const HIT_CONTEXT_WORDS = 10;
/** About how long a default excerpt is; a sentence runs on to a whole one up to the longer limit. */
const DEFAULT_WORDS = 20;
const DEFAULT_WORDS_MAX = 26;
const SENTENCE_MIN_WORDS = 8;

/** How the default excerpt is chosen: the piece's opening, its most unusual sentence, or the sentence about the paper's keywords. */
export const DEFAULT_METHODS = ['first', 'rare', 'keywords'] as const;
export type DefaultMethod = (typeof DEFAULT_METHODS)[number];

const ELLIPSIS = '…';

const wordSpans = (text: string): TextRange[] =>
  [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

/** The words from index `from` to `to`, with an ellipsis at each end where `open` says the text goes on. */
function cut(
  text: string,
  spans: TextRange[],
  from: number,
  to: number,
  open = [true, true],
): string {
  const lead = open[0] && from > 0 ? ELLIPSIS : '';
  const trail = open[1] && to < spans.length - 1 ? ELLIPSIS : '';
  return lead + text.slice(spans[from].start, spans[to].end) + trail;
}

/**
 * The words around the hits, from `context` words before the first to `context` after the
 * last, so several hits read as one passage; null when there are none.
 */
export function hitExcerpt(
  text: string,
  hits: readonly TextRange[],
  context = HIT_CONTEXT_WORDS,
): string | null {
  if (hits.length === 0) return null;
  const spans = wordSpans(text);
  const hitStart = Math.min(...hits.map((h) => h.start));
  const hitEnd = Math.max(...hits.map((h) => h.end));
  const first = spans.findIndex((s) => s.end > hitStart);
  const last = spans.filter((s) => s.start < hitEnd).length - 1;
  if (first < 0 || last < first) return null;
  return cut(text, spans, Math.max(0, first - context), Math.min(spans.length - 1, last + context));
}

const NOT_AN_END = new Set([
  'al',
  'fig',
  'figs',
  'eq',
  'eqs',
  'e.g',
  'i.e',
  'vs',
  'cf',
  'etc',
  'sec',
  'no',
  'dr',
]);

/** Where each sentence starts and ends, as word indexes. A full stop after an abbreviation or an initial does not end one. */
function sentences(text: string, spans: TextRange[]): [number, number][] {
  const found: [number, number][] = [];
  let from = 0;
  for (let i = 0; i < spans.length; i++) {
    const word = text.slice(spans[i].start, spans[i].end);
    const ends = /[.!?]["”')\]]*$/.test(word);
    const stem = word
      .replace(/[^\p{L}.]/gu, '')
      .replace(/\.+$/, '')
      .toLowerCase();
    const next = i + 1 < spans.length ? text[spans[i + 1].start] : '';
    const startsSentence = next === '' || /[\p{Lu}"“([\d]/u.test(next);
    if (ends && startsSentence && !NOT_AN_END.has(stem) && stem.length > 1) {
      found.push([from, i]);
      from = i + 1;
    }
  }
  if (from < spans.length) found.push([from, spans.length - 1]);
  return found;
}

const alphabetic = (text: string): string[] => text.toLowerCase().match(/\p{L}{4,}/gu) ?? [];

/** How unusual a word is across the papers: the log of how many pieces there are for each that has it. */
export type Rarity = (word: string) => number;

export const rarityOf = memoByValue((texts: PaperTexts): Rarity => {
  const pieces = Object.values(texts);
  const holding = new Map<string, number>();
  for (const piece of pieces) {
    for (const word of new Set(alphabetic(piece))) holding.set(word, (holding.get(word) ?? 0) + 1);
  }
  return (word) => Math.log(pieces.length / (holding.get(word) ?? 1));
});

/** Words are compared by their first letters, so "visualization" meets "visualizations". */
const stemOf = (word: string): string => word.slice(0, 5);

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export interface DefaultInput {
  method: DefaultMethod;
  rarity: Rarity;
  /** The paper's keywords. */
  keywords: readonly string[];
}

/** A sentence's score, higher the better chosen; null if it is not a candidate. */
function score(sentence: string, { method, rarity, keywords }: DefaultInput): number | null {
  const words = alphabetic(sentence);
  const tokens = sentence.split(/\s+/).length;
  // A table, a formula, a list of numbers or an author's address has few words in it.
  if (tokens < SENTENCE_MIN_WORDS || words.length < tokens * 0.4 || sentence.includes('@'))
    return null;
  const distinct = [...new Set(words)];
  const unusual = mean(distinct.map(rarity));
  if (method === 'rare') return unusual;
  const wanted = new Set(keywords.flatMap(alphabetic).map(stemOf));
  const matched = distinct.filter((w) => wanted.has(stemOf(w)));
  // The keywords decide; how unusual the rest is only separates sentences that tie.
  return matched.length + unusual / 100;
}

/** The excerpt to show when nothing is searched: about twenty words. */
export function defaultExcerpt(text: string, input: DefaultInput): string {
  const spans = wordSpans(text);
  if (spans.length === 0) return '';
  const all = sentences(text, spans);
  let pick = all[0];
  if (input.method !== 'first') {
    let best: number | null = null;
    for (const range of all) {
      const s = score(text.slice(spans[range[0]].start, spans[range[1]].end), input);
      if (s !== null && (best === null || s > best)) {
        best = s;
        pick = range;
      }
    }
  }
  let [from, to] = pick;
  // A short sentence runs on into the next ones.
  for (let n = all.indexOf(pick) + 1; to - from + 1 < DEFAULT_WORDS * 0.6 && n < all.length; n++) {
    if (all[n][1] - from + 1 > DEFAULT_WORDS_MAX) break;
    to = all[n][1];
  }
  const truncated = to - from + 1 > DEFAULT_WORDS_MAX;
  if (truncated) to = from + DEFAULT_WORDS - 1;
  // It starts and ends on sentence boundaries, so only a cut sentence gets an ellipsis.
  return cut(text, spans, from, to, [false, truncated]);
}
