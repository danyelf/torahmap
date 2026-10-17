// What counts as a match, for both the search that finds items and the
// highlighter that marks them.
import type { SearchLanguage, TextRange } from './language.ts';

export type MatchMode = 'substring' | 'word';

/**
 * Where `needle` sits in `haystack`, both already folded by the language.
 *
 * The search index stores its text folded, and folding it again for each of
 * 23,000 verses costs twenty times what the search itself does. So the rule
 * lives here and the folding is the caller's, done once.
 *
 * `limit` stops the scan early, for callers that only need to know whether
 * there is a match at all.
 */
export function matchRanges(
  haystack: string,
  needle: string,
  options: { mode: MatchMode; language: SearchLanguage; limit?: number },
): TextRange[] {
  const { mode, language, limit = Infinity } = options;
  if (needle.length === 0 || limit <= 0) return [];
  if (mode === 'word') return language.wholeWords(haystack, needle, limit);

  const ranges: TextRange[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push({ start: at, end: at + needle.length });
    if (ranges.length >= limit) break;
    from = at + 1;
  }
  return ranges;
}
