// Full-text search with word-wheeling support for Hebrew and English

import type { VerseTexts } from './verseTexts';

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  language: 'he' | 'en';
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

  // Canonical book order
  const bookOrder = [
    // Torah
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    // Prophets
    'Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings',
    'Isaiah', 'Jeremiah', 'Ezekiel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    // Writings
    'Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth', 'Lamentations',
    'Ecclesiastes', 'Esther', 'Daniel', 'Ezra', 'Nehemiah',
    'I Chronicles', 'II Chronicles'
  ];

  for (const book of bookOrder) {
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
 * Search for verses matching the query
 * Returns ALL matching verses (no cap) so highlighting works across entire Tanakh
 */
export function search(query: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const isHebrew = isHebrewQuery(query);
  const results: SearchResult[] = [];

  if (isHebrew) {
    const normalizedQuery = stripNikkud(query);

    for (const entry of searchIndex) {
      const idx = entry.hebrewText.indexOf(normalizedQuery);
      if (idx !== -1) {
        // Find corresponding position in original text (approximate)
        const snippet = createSnippet(entry.hebrewOriginal, idx, normalizedQuery.length);
        results.push({
          book: entry.book,
          chapter: entry.chapter,
          verse: entry.verse,
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          language: 'he',
        });
      }
    }
  } else {
    const normalizedQuery = query.toLowerCase();

    for (const entry of searchIndex) {
      const idx = entry.englishText.indexOf(normalizedQuery);
      if (idx !== -1) {
        const snippet = createSnippet(entry.englishOriginal, idx, normalizedQuery.length);
        results.push({
          book: entry.book,
          chapter: entry.chapter,
          verse: entry.verse,
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          language: 'en',
        });
      }
    }
  }

  return results;
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
 * Get all matching verse keys for highlighting
 */
export function getMatchingVerseKeys(results: SearchResult[]): Set<string> {
  const keys = new Set<string>();
  for (const r of results) {
    keys.add(`${r.book}:${r.chapter}:${r.verse}`);
  }
  return keys;
}
