// The part of a piece's text the popup shows: the words around a search hit, or a short
// default when nothing is searched.

import type { TextRange } from '@torahmap/utils';

/** Words kept on each side of the hits. */
export const HIT_CONTEXT_WORDS = 10;
/** The most words between two hits that are still shown. */
export const HIT_GAP_WORDS = 60;
const ELLIPSIS = '…';

const wordSpans = (text: string): TextRange[] =>
  [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

/** The words from index `from` to `to`, with an ellipsis at each end where the text goes on. */
function cut(text: string, spans: TextRange[], from: number, to: number): string {
  const lead = from > 0 ? ELLIPSIS : '';
  const words = text.slice(spans[from].start, spans[to].end);
  const trail = to < spans.length - 1 && !words.endsWith(ELLIPSIS) ? ELLIPSIS : '';
  return lead + words + trail;
}

/**
 * The words around the hits, `context` words either side. Hits no more than `gap` words apart
 * read as one passage, with the words between them; further apart, the middle is left out.
 * Null when there are no hits.
 */
export function hitExcerpt(
  text: string,
  hits: readonly TextRange[],
  context = HIT_CONTEXT_WORDS,
  gap = HIT_GAP_WORDS,
): string | null {
  const spans = wordSpans(text);
  const found = hits
    .map((h) => ({
      from: spans.findIndex((s) => s.end > h.start),
      to: spans.filter((s) => s.start < h.end).length - 1,
    }))
    .filter((h) => h.from >= 0 && h.to >= h.from)
    .sort((a, b) => a.from - b.from);
  if (found.length === 0) return null;

  const passages = [{ ...found[0] }];
  for (const hit of found.slice(1)) {
    const last = passages[passages.length - 1];
    if (hit.from - last.to - 1 <= gap) last.to = Math.max(last.to, hit.to);
    else passages.push({ ...hit });
  }
  const reach = passages.map(({ from, to }) => ({
    from: Math.max(0, from - context),
    to: Math.min(spans.length - 1, to + context),
  }));
  const read = reach
    .map((r) => text.slice(spans[r.from].start, spans[r.to].end))
    .join(` ${ELLIPSIS} `);
  const lead = reach[0].from > 0 ? ELLIPSIS : '';
  const trail = reach[reach.length - 1].to < spans.length - 1 ? ELLIPSIS : '';
  return lead + read + trail;
}

/** About how long a default excerpt is. */
const DEFAULT_WORDS = 30;

/** Keywords shorter than this are ignored; words are compared by their first letters, so "text" meets "texts". */
const STEM_LETTERS = 4;

const stemOf = (word: string): string =>
  word
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '')
    .slice(0, STEM_LETTERS);

/**
 * The excerpt to show when nothing is searched: the thirty words that hold the most of the
 * paper's keywords, or the text's opening when none of them appear.
 */
export function defaultExcerpt(text: string, keywords: readonly string[]): string {
  const spans = wordSpans(text);
  if (spans.length === 0) return '';
  const wanted = new Set(
    keywords
      .flatMap((k) => k.match(new RegExp(`\\p{L}{${STEM_LETTERS},}`, 'gu')) ?? [])
      .map(stemOf),
  );
  const held = spans.map((s) => Number(wanted.has(stemOf(text.slice(s.start, s.end)))));
  let count = held.slice(0, DEFAULT_WORDS).reduce((a, b) => a + b, 0);
  let best = { count, from: 0 };
  for (let from = 1; from + DEFAULT_WORDS <= spans.length; from++) {
    count += held[from + DEFAULT_WORDS - 1] - held[from - 1];
    if (count > best.count) best = { count, from };
  }
  return cut(text, spans, best.from, Math.min(spans.length, best.from + DEFAULT_WORDS) - 1);
}
