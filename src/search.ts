// Full-text search with word-wheeling support for Hebrew and English

import type { VerseTexts } from './verseTexts';
import { BOOK_ORDER } from './constants/books.ts';
import { getVerseKey } from './types.ts';

export interface TermMatch {
  termIndex: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  language: 'he' | 'en';
  matchingTerms: TermMatch[];
}

interface IndexEntry {
  book: string;
  chapter: number;
  verse: number;
  hebrewText: string;      // nikkud-stripped
  hebrewOriginal: string;  // original for display
  englishText: string;     // lowercased
  englishOriginal: string; // original for display
}

// Unicode range for Hebrew characters
const HEBREW_RANGE_START = 0x0590;
const HEBREW_RANGE_END = 0x05FF;

// Nikkud (vowel marks) range
const NIKKUD_START = 0x0591;
const NIKKUD_END = 0x05C7;

let searchIndex: IndexEntry[] = [];

/**
 * Strip Hebrew vowel marks (nikkud) from text
 */
export function stripNikkud(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip nikkud marks but keep Hebrew letters and other characters
    if (code < NIKKUD_START || code > NIKKUD_END || code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6) {
      result += char;
    }
  }
  return result;
}

/**
 * Parse comma-separated search terms, filtering empty ones
 */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length >= 2);
}

/**
 * Detect if a string contains Hebrew characters
 */
export function isHebrewQuery(query: string): boolean {
  for (const char of query) {
    const code = char.charCodeAt(0);
    if (code >= HEBREW_RANGE_START && code <= HEBREW_RANGE_END) {
      return true;
    }
  }
  return false;
}

/**
 * Build the search index from loaded verse texts
 */
export function buildSearchIndex(verseTexts: VerseTexts): void {
  searchIndex = [];

  for (const book of BOOK_ORDER) {
    const chapters = verseTexts[book];
    if (!chapters) continue;

    const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b);
    for (const chapter of chapterNums) {
      const verses = chapters[String(chapter)];
      const verseNums = Object.keys(verses).map(Number).sort((a, b) => a - b);

      for (const verse of verseNums) {
        const { he, en } = verses[String(verse)];
        searchIndex.push({
          book,
          chapter,
          verse,
          hebrewText: stripNikkud(he),
          hebrewOriginal: he,
          englishText: en.toLowerCase(),
          englishOriginal: en,
        });
      }
    }
  }

  console.log(`Search index built with ${searchIndex.length} verses`);
}

/**
 * Search for verses matching any of the comma-separated terms
 * Returns ALL matching verses with info about which terms matched
 */
export function search(query: string): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // Determine language from first term (all terms use same language)
  const isHebrew = isHebrewQuery(terms[0]);

  // Map: verseKey -> SearchResult
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

    for (const entry of searchIndex) {
      const text = isHebrew ? entry.hebrewText : entry.englishText;
      const original = isHebrew ? entry.hebrewOriginal : entry.englishOriginal;
      const idx = text.indexOf(normalizedTerm);

      if (idx !== -1) {
        const key = `${entry.book}:${entry.chapter}:${entry.verse}`;
        const snippet = createSnippet(original, idx, normalizedTerm.length);

        let result = resultMap.get(key);
        if (!result) {
          result = {
            book: entry.book,
            chapter: entry.chapter,
            verse: entry.verse,
            language: isHebrew ? 'he' : 'en',
            matchingTerms: [],
          };
          resultMap.set(key, result);
        }

        // Only add if this term hasn't matched this verse yet
        if (!result.matchingTerms.some(m => m.termIndex === termIndex)) {
          result.matchingTerms.push({
            termIndex,
            snippet: snippet.text,
            matchStart: snippet.matchStart,
            matchEnd: snippet.matchEnd,
          });
        }
      }
    }
  }

  return Array.from(resultMap.values());
}

interface SnippetResult {
  text: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Create a snippet around the match position
 */
function createSnippet(text: string, matchIdx: number, matchLen: number): SnippetResult {
  const maxLen = 60;
  const contextBefore = 20;

  let start = Math.max(0, matchIdx - contextBefore);
  let end = Math.min(text.length, start + maxLen);

  // Adjust start if we're near the end
  if (end === text.length && end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  const adjustedMatchStart = matchIdx - start;
  const adjustedMatchEnd = adjustedMatchStart + matchLen;

  // Add ellipsis if truncated
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }

  return {
    text: snippet,
    matchStart: start > 0 ? adjustedMatchStart + 3 : adjustedMatchStart,
    matchEnd: start > 0 ? adjustedMatchEnd + 3 : adjustedMatchEnd,
  };
}

/**
 * Get map of verse keys to their matching term indices
 */
export function getMatchingVerseTerms(results: SearchResult[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const r of results) {
    const key = getVerseKey(r.book, r.chapter, r.verse);
    map.set(key, r.matchingTerms.map(m => m.termIndex));
  }
  return map;
}

// Keep old function for backwards compatibility during transition
export function getMatchingVerseKeys(results: SearchResult[]): Set<string> {
  return new Set(getMatchingVerseTerms(results).keys());
}
