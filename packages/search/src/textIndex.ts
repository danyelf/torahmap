// The items a search reads, folded once for matching, and what a search finds
// among them.

import { SEARCH_SNIPPET_CONTEXT_BEFORE, SEARCH_SNIPPET_MAX_LENGTH } from './constants.ts';
import type { SearchLanguage, TextRange } from './language.ts';
import { matchRanges, type MatchMode } from './matching.ts';

/** One item as search reads it: its id, the reference a result is listed by, and its text by language id. */
export interface SearchEntry {
  readonly id: string;
  readonly ref: string;
  readonly text: Readonly<Record<string, string>>;
}

interface IndexedEntry extends SearchEntry {
  /** Each language's text, folded by that language. */
  readonly folded: Readonly<Record<string, string>>;
}

/** Every item folded for matching, in order, and each by its id. */
export interface TextIndex {
  readonly entries: readonly IndexedEntry[];
  readonly byId: ReadonlyMap<string, IndexedEntry>;
}

export function buildTextIndex(
  entries: Iterable<SearchEntry>,
  languages: readonly SearchLanguage[],
): TextIndex {
  const indexed: IndexedEntry[] = [];
  const byId = new Map<string, IndexedEntry>();
  for (const entry of entries) {
    const folded: Record<string, string> = {};
    for (const language of languages) {
      const text = entry.text[language.id];
      if (text !== undefined) folded[language.id] = language.fold(text);
    }
    const item = { ...entry, folded };
    indexed.push(item);
    byId.set(item.id, item);
  }
  return { entries: indexed, byId };
}

/** The items a term's text matches, in the text of its own language. */
export function itemsForTerm(
  index: TextIndex,
  text: string,
  language: SearchLanguage,
  mode: MatchMode,
): Set<string> {
  const needle = language.fold(text);
  const items = new Set<string>();
  for (const entry of index.entries) {
    const haystack = entry.folded[language.id];
    if (haystack === undefined) continue;
    if (matchRanges(haystack, needle, { mode, language, limit: 1 }).length > 0) {
      items.add(entry.id);
    }
  }
  return items;
}

/** An item's text in a language as the reader sees it, or null for an item the index lacks. */
export function displayedText(
  index: TextIndex,
  id: string,
  language: SearchLanguage,
): string | null {
  return index.byId.get(id)?.text[language.id] ?? null;
}

export interface TermMatch {
  termIndex: number;
}

export interface SearchResult {
  id: string;
  ref: string;
  matchingTerms: TermMatch[];
}

/**
 * Turn per-term sets of item ids into search results.
 *
 * The sets arrive already decided: how a term finds its items, by its text or
 * by its extra mode, is the caller's.
 *
 * A term with no hits simply contributes nothing; term indices are positions
 * in the caller's list, so the gap keeps every other term's colour in place.
 */
export function resultsForItemSets(
  index: TextIndex,
  termItems: ReadonlyArray<ReadonlySet<string>>,
): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < termItems.length; termIndex++) {
    for (const id of termItems[termIndex]) {
      const entry = index.byId.get(id);
      if (!entry) continue;

      let result = resultMap.get(id);
      if (!result) {
        result = { id: entry.id, ref: entry.ref, matchingTerms: [] };
        resultMap.set(id, result);
      }
      if (!result.matchingTerms.some((m) => m.termIndex === termIndex)) {
        result.matchingTerms.push({ termIndex });
      }
    }
  }

  return Array.from(resultMap.values());
}

/** Each result's id to the positions, among the searched terms, of the terms it matches. */
export function matchingTermsOf(results: SearchResult[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const r of results) {
    map.set(
      r.id,
      r.matchingTerms.map((m) => m.termIndex),
    );
  }
  return map;
}

/** The text around a match, and where the match sits in it. */
export interface Snippet {
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

/** A text quoted around a stretch of it, or its opening when there is nothing to mark. */
export function quoteText(text: string, range: TextRange | null): Snippet {
  if (!range) {
    const limit = SEARCH_SNIPPET_MAX_LENGTH;
    return {
      snippet: text.length > limit ? `${text.slice(0, limit)}...` : text,
      matchStart: 0,
      matchEnd: 0,
    };
  }
  const maxLen = SEARCH_SNIPPET_MAX_LENGTH;
  const matchEnd = Math.min(range.end, text.length);

  let start = Math.max(0, range.start - SEARCH_SNIPPET_CONTEXT_BEFORE);
  const end = Math.min(text.length, start + maxLen);
  if (end === text.length && end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  let prefixLen = 0;
  if (start > 0) {
    snippet = '...' + snippet;
    prefixLen = 3;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }

  return {
    snippet,
    matchStart: range.start - start + prefixLen,
    matchEnd: Math.min(matchEnd - start + prefixLen, snippet.length),
  };
}
