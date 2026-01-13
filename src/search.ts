// Full-text search with word-wheeling support for Hebrew and English
// Now with Hebrew lemmatization via morphhb Strong's numbers

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

// Common Hebrew prefixes that can be stripped for lemma lookup
const HEBREW_PREFIXES = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש'];
// Two-letter prefix combinations
const HEBREW_PREFIX_COMBOS = ['וב', 'וה', 'ול', 'וכ', 'ומ', 'וש', 'מה', 'שב', 'של', 'בה'];

let searchIndex: IndexEntry[] = [];

// Lemma data loaded from morphhb
let wordLemmas: Record<string, string[]> | null = null;  // Hebrew word -> Strong's numbers
let verseLemmas: Record<string, string[]> | null = null; // verse key -> Strong's numbers

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
 * Load lemma data from morphhb (called during initialization)
 */
export async function loadLemmaData(): Promise<void> {
  try {
    const [wordRes, verseRes] = await Promise.all([
      fetch('/data/word-lemmas.json'),
      fetch('/data/verse-lemmas.json'),
    ]);

    if (wordRes.ok && verseRes.ok) {
      wordLemmas = await wordRes.json();
      verseLemmas = await verseRes.json();
      console.log('Lemma data loaded for Hebrew canonicalization');
    } else {
      console.warn('Failed to load lemma data, falling back to substring search');
    }
  } catch (err) {
    console.warn('Error loading lemma data:', err);
  }
}

/**
 * Try to find Strong's numbers (lemmas) for a Hebrew word
 * Tries:
 * 1. Direct lookup
 * 2. With common prefixes stripped (ו, ה, ב, ל, כ, מ, ש)
 * 3. With two-letter prefix combos stripped
 */
function findLemmasForWord(hebrewWord: string): string[] | null {
  if (!wordLemmas) return null;

  const stripped = stripNikkud(hebrewWord);

  // Try direct lookup
  if (wordLemmas[stripped]) {
    return wordLemmas[stripped];
  }

  // Try stripping two-letter prefix combos first
  for (const prefix of HEBREW_PREFIX_COMBOS) {
    if (stripped.startsWith(prefix) && stripped.length > prefix.length + 1) {
      const withoutPrefix = stripped.slice(prefix.length);
      if (wordLemmas[withoutPrefix]) {
        return wordLemmas[withoutPrefix];
      }
    }
  }

  // Try stripping single-letter prefixes
  for (const prefix of HEBREW_PREFIXES) {
    if (stripped.startsWith(prefix) && stripped.length > 2) {
      const withoutPrefix = stripped.slice(prefix.length);
      if (wordLemmas[withoutPrefix]) {
        return wordLemmas[withoutPrefix];
      }
    }
  }

  return null;
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
 * Search by Strong's numbers (lemmas) for Hebrew terms
 * Returns verse keys that contain any of the specified lemmas
 */
function searchByLemmas(lemmas: string[]): Set<string> {
  const matchingVerses = new Set<string>();

  if (!verseLemmas) return matchingVerses;

  for (const [verseKey, verseLemmasList] of Object.entries(verseLemmas)) {
    // Check if this verse contains any of the search lemmas
    if (lemmas.some(lemma => verseLemmasList.includes(lemma))) {
      matchingVerses.add(verseKey);
    }
  }

  return matchingVerses;
}

/**
 * Search for verses matching any of the comma-separated terms
 * Returns ALL matching verses with info about which terms matched
 *
 * For Hebrew: Uses lemma-based search via morphhb Strong's numbers, with fallback to substring
 * For English: Uses substring search
 */
export function search(query: string): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // Determine language from first term (all terms use same language)
  const isHebrew = isHebrewQuery(terms[0]);

  // Map: verseKey -> SearchResult
  const resultMap = new Map<string, SearchResult>();

  // For Hebrew, try lemma-based search first
  if (isHebrew && wordLemmas && verseLemmas) {
    const termLemmas: Array<{ termIndex: number; lemmas: string[] }> = [];

    // Collect lemmas for each search term
    for (let termIndex = 0; termIndex < terms.length; termIndex++) {
      const lemmas = findLemmasForWord(terms[termIndex]);
      if (lemmas && lemmas.length > 0) {
        termLemmas.push({ termIndex, lemmas });
      }
    }

    // If we found lemmas for any terms, use lemma-based search
    if (termLemmas.length > 0) {
      for (const { termIndex, lemmas } of termLemmas) {
        const matchingVerseKeys = searchByLemmas(lemmas);

        for (const verseKey of matchingVerseKeys) {
          // Find the corresponding index entry
          const entry = searchIndex.find(e =>
            `${e.book}:${e.chapter}:${e.verse}` === verseKey
          );

          if (entry) {
            let result = resultMap.get(verseKey);
            if (!result) {
              result = {
                book: entry.book,
                chapter: entry.chapter,
                verse: entry.verse,
                language: 'he',
                matchingTerms: [],
              };
              resultMap.set(verseKey, result);
            }

            // Only add if this term hasn't matched this verse yet
            if (!result.matchingTerms.some(m => m.termIndex === termIndex)) {
              // Find position of search term in verse text for highlighting
              const normalizedTerm = stripNikkud(terms[termIndex]);
              const idx = entry.hebrewText.indexOf(normalizedTerm);

              if (idx !== -1) {
                // Use createSnippet for consistent position mapping
                const snippet = createSnippet(entry.hebrewOriginal, idx, normalizedTerm.length, true);
                result.matchingTerms.push({
                  termIndex,
                  snippet: snippet.text,
                  matchStart: snippet.matchStart,
                  matchEnd: snippet.matchEnd,
                });
              } else {
                // Fallback: term not found as substring (lemma matches different form)
                result.matchingTerms.push({
                  termIndex,
                  snippet: entry.hebrewOriginal.slice(0, 60) + (entry.hebrewOriginal.length > 60 ? '...' : ''),
                  matchStart: 0,
                  matchEnd: 0,
                });
              }
            }
          }
        }
      }

      // If we got results from lemma search, return them
      if (resultMap.size > 0) {
        return Array.from(resultMap.values());
      }
    }
  }

  // Fallback to substring search (for English or if lemma search failed/unavailable)
  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? stripNikkud(term) : term.toLowerCase();

    for (const entry of searchIndex) {
      const text = isHebrew ? entry.hebrewText : entry.englishText;
      const original = isHebrew ? entry.hebrewOriginal : entry.englishOriginal;
      const idx = text.indexOf(normalizedTerm);

      if (idx !== -1) {
        const key = `${entry.book}:${entry.chapter}:${entry.verse}`;
        const snippet = createSnippet(original, idx, normalizedTerm.length, isHebrew);

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
 * Map a position in nikkud-stripped text to the corresponding position in original text
 */
function mapStrippedToOriginal(original: string, strippedPos: number): number {
  let normalizedPos = 0;
  for (let i = 0; i < original.length; i++) {
    if (normalizedPos === strippedPos) {
      return i;
    }
    const code = original.charCodeAt(i);
    const isNikkud = code >= NIKKUD_START && code <= NIKKUD_END &&
                     code !== 0x05BE && code !== 0x05C0 && code !== 0x05C3 && code !== 0x05C6;
    if (!isNikkud) {
      normalizedPos++;
    }
  }
  return original.length;
}

/**
 * Count nikkud characters in a range of the original text
 */
function countNikkudInRange(text: string, start: number, strippedLen: number): number {
  let nikkudCount = 0;
  let nonNikkudCount = 0;
  for (let i = start; i < text.length && nonNikkudCount < strippedLen; i++) {
    const code = text.charCodeAt(i);
    const isNikkud = code >= NIKKUD_START && code <= NIKKUD_END &&
                     code !== 0x05BE && code !== 0x05C0 && code !== 0x05C3 && code !== 0x05C6;
    if (isNikkud) {
      nikkudCount++;
    } else {
      nonNikkudCount++;
    }
  }
  return nikkudCount;
}

/**
 * Create a snippet around the match position
 * For Hebrew, matchIdx/matchLen refer to positions in the nikkud-stripped text
 */
function createSnippet(text: string, matchIdx: number, matchLen: number, isHebrew: boolean = false): SnippetResult {
  const maxLen = 60;
  const contextBefore = 20;

  // For Hebrew, map stripped positions to original positions
  let origMatchStart = matchIdx;
  let origMatchEnd = matchIdx + matchLen;

  if (isHebrew) {
    origMatchStart = mapStrippedToOriginal(text, matchIdx);
    const nikkudInMatch = countNikkudInRange(text, origMatchStart, matchLen);
    origMatchEnd = origMatchStart + matchLen + nikkudInMatch;
  }

  let start = Math.max(0, origMatchStart - contextBefore);
  let end = Math.min(text.length, start + maxLen);

  // Adjust start if we're near the end
  if (end === text.length && end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  const adjustedMatchStart = origMatchStart - start;
  const adjustedMatchEnd = origMatchEnd - start;

  // Add ellipsis if truncated
  let prefixLen = 0;
  if (start > 0) {
    snippet = '...' + snippet;
    prefixLen = 3;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }

  return {
    text: snippet,
    matchStart: adjustedMatchStart + prefixLen,
    matchEnd: Math.min(adjustedMatchEnd + prefixLen, snippet.length),
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
