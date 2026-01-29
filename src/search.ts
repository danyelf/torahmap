// Full-text search with word-wheeling support for Hebrew and English
// Now with Hebrew lemmatization via morphhb Strong's numbers

import type { VerseTexts } from './verseTexts';
import { BOOK_ORDER } from './constants/books.ts';
import { getVerseKey } from './types.ts';
import {
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_SNIPPET_MAX_LENGTH,
  SEARCH_SNIPPET_CONTEXT_BEFORE,
} from './constants/app.ts';

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

// Hebrew final forms (sofit) - map final form to regular form
const FINAL_FORM_MAP: Record<string, string> = {
  'ך': 'כ', // kaf sofit (U+05DA) → kaf (U+05DB)
  'ם': 'מ', // mem sofit (U+05DD) → mem (U+05DE)
  'ן': 'נ', // nun sofit (U+05DF) → nun (U+05E0)
  'ף': 'פ', // pe sofit (U+05E3) → pe (U+05E4)
  'ץ': 'צ', // tzadi sofit (U+05E5) → tzadi (U+05E6)
};

// Common Hebrew prefixes that can be stripped for lemma lookup
const HEBREW_PREFIXES = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש'];
// Two-letter prefix combinations
const HEBREW_PREFIX_COMBOS = ['וב', 'וה', 'ול', 'וכ', 'ומ', 'וש', 'מה', 'שב', 'של', 'בה'];

let searchIndex: IndexEntry[] = [];
// Fast lookup map: verse key -> index entry (avoids O(n) find() calls)
let verseKeyToEntry: Map<string, IndexEntry> = new Map();

// Lemma data loaded from morphhb
let wordLemmas: Record<string, string[]> | null = null;  // Hebrew word -> Strong's numbers
let verseLemmas: Record<string, string[]> | null = null; // verse key -> Strong's numbers
let strongsToRoot: Record<string, string> | null = null; // Strong's number -> Hebrew root
// Inverted index: Strong's number -> Set of verse keys (for fast lemma-based search)
let lemmaToVerses: Map<string, Set<string>> | null = null;

/**
 * Strip Hebrew vowel marks (nikkud) from text (preserves final forms)
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
 * Normalize Hebrew text for search: strip nikkud AND normalize final forms
 * Final forms (sofit) are converted to their regular equivalents:
 * ך → כ, ם → מ, ן → נ, ף → פ, ץ → צ
 *
 * This function is used for search matching, where we want both forms to match.
 * Use stripNikkud() if you want to preserve final forms (e.g., for display).
 */
export function normalizeHebrewForSearch(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip nikkud marks but keep Hebrew letters and other characters
    if (code < NIKKUD_START || code > NIKKUD_END || code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6) {
      // Normalize final forms to regular forms
      result += FINAL_FORM_MAP[char] || char;
    }
  }
  return result;
}

/**
 * Parse comma-separated search terms, filtering empty ones
 * Supports multiple comma variants: English (U+002C), Arabic (U+060C), Hebrew Gershayim (U+05F4)
 */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(/[,،‎\u05F4]/)  // Split on English comma, Arabic comma, or Hebrew Gershayim
    .map(t => t.trim())
    .filter(t => t.length >= MIN_SEARCH_TERM_LENGTH);
}

/**
 * Load lemma data from morphhb (called during initialization)
 */
export async function loadLemmaData(): Promise<void> {
  try {
    console.log('Loading lemma data files...');
    const [wordRes, verseRes, strongsRes] = await Promise.all([
      fetch('/data/word-lemmas.json'),
      fetch('/data/verse-lemmas.json'),
      fetch('/data/strongs-to-root.json'),
    ]);

    console.log(`Fetch results: word=${wordRes.status}, verse=${verseRes.status}, strongs=${strongsRes.status}`);

    if (wordRes.ok && verseRes.ok && strongsRes.ok) {
      console.log('Parsing JSON...');
      wordLemmas = await wordRes.json();
      verseLemmas = await verseRes.json();
      strongsToRoot = await strongsRes.json();

      console.log(`✓ Loaded: ${Object.keys(wordLemmas).length} words, ${Object.keys(verseLemmas).length} verses, ${Object.keys(strongsToRoot).length} Strong's numbers`);

      // Build inverted index: Strong's number -> Set of verse keys
      // This converts O(V) search-by-lemma to O(1) lookup
      buildLemmaInvertedIndex();
    } else {
      console.warn('Failed to load lemma data, falling back to substring search');
      console.warn(`Response status: word=${wordRes.status}, verse=${verseRes.status}, strongs=${strongsRes.status}`);
      console.warn(`URLs tried: ${wordRes.url}, ${verseRes.url}, ${strongsRes.url}`);
    }
  } catch (err) {
    console.warn('Error loading lemma data:', err);
  }
}

/**
 * Build inverted index from verseLemmas: lemma -> Set<verseKey>
 * This enables O(1) lookup for lemma-based searches instead of O(n) iteration
 */
function buildLemmaInvertedIndex(): void {
  if (!verseLemmas) {
    lemmaToVerses = null;
    console.warn('Cannot build lemma inverted index: verseLemmas is null');
    return;
  }

  const startTime = performance.now();
  lemmaToVerses = new Map();

  for (const [verseKey, lemmas] of Object.entries(verseLemmas)) {
    for (const lemma of lemmas) {
      let verses = lemmaToVerses.get(lemma);
      if (!verses) {
        verses = new Set();
        lemmaToVerses.set(lemma, verses);
      }
      verses.add(verseKey);
    }
  }

  const endTime = performance.now();
  console.log(`✓ Built lemma inverted index: ${lemmaToVerses.size} unique lemmas in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Try to find Strong's numbers (lemmas) for a Hebrew word
 * Tries:
 * 1. Direct lookup
 * 2. With common prefixes stripped (ו, ה, ב, ל, כ, מ, ש)
 * 3. With two-letter prefix combos stripped
 * Exported for use in overlay UI to show which terms have lemma data
 */
export function findLemmasForWord(hebrewWord: string): string[] | null {
  if (!wordLemmas) {
    console.log(`findLemmasForWord("${hebrewWord}"): wordLemmas is null`);
    return null;
  }

  // Use stripNikkud (preserves final forms) not normalizeHebrewForSearch (converts final forms)
  // The morphhb database keys use final forms, so we need to preserve them
  const stripped = stripNikkud(hebrewWord);
  console.log(`findLemmasForWord("${hebrewWord}") stripped to "${stripped}"`);

  // Try direct lookup
  if (wordLemmas[stripped]) {
    console.log(`  ✓ Found direct match: ${wordLemmas[stripped].length} lemmas`);
    return wordLemmas[stripped];
  }

  // Try stripping two-letter prefix combos first
  for (const prefix of HEBREW_PREFIX_COMBOS) {
    if (stripped.startsWith(prefix) && stripped.length > prefix.length + 1) {
      const withoutPrefix = stripped.slice(prefix.length);
      if (wordLemmas[withoutPrefix]) {
        console.log(`  ✓ Found after stripping prefix "${prefix}": ${wordLemmas[withoutPrefix].length} lemmas`);
        return wordLemmas[withoutPrefix];
      }
    }
  }

  // Try stripping single-letter prefixes
  for (const prefix of HEBREW_PREFIXES) {
    if (stripped.startsWith(prefix) && stripped.length > 2) {
      const withoutPrefix = stripped.slice(prefix.length);
      if (wordLemmas[withoutPrefix]) {
        console.log(`  ✓ Found after stripping prefix "${prefix}": ${wordLemmas[withoutPrefix].length} lemmas`);
        return wordLemmas[withoutPrefix];
      }
    }
  }

  console.log(`  ✗ No lemmas found (tried direct and with prefixes stripped)`);
  return null;
}

/**
 * Get the Hebrew root for a Strong's number
 * Exported for use in overlay UI to show which root was matched
 */
export function getRootForStrongsNumber(strongsNum: string): string | null {
  if (!strongsToRoot) return null;
  return strongsToRoot[strongsNum] || null;
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
  verseKeyToEntry.clear();

  for (const book of BOOK_ORDER) {
    const chapters = verseTexts[book];
    if (!chapters) continue;

    const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b);
    for (const chapter of chapterNums) {
      const verses = chapters[String(chapter)];
      const verseNums = Object.keys(verses).map(Number).sort((a, b) => a - b);

      for (const verse of verseNums) {
        const { he, en } = verses[String(verse)];
        const entry: IndexEntry = {
          book,
          chapter,
          verse,
          hebrewText: normalizeHebrewForSearch(he),
          hebrewOriginal: he,
          englishText: en.toLowerCase(),
          englishOriginal: en,
        };
        searchIndex.push(entry);

        // Build fast lookup map
        const verseKey = `${book}:${chapter}:${verse}`;
        verseKeyToEntry.set(verseKey, entry);
      }
    }
  }
}

/**
 * Search by Strong's numbers (lemmas) for Hebrew terms
 * Returns verse keys that contain any of the specified lemmas
 * Uses inverted index for O(1) lookup per lemma instead of O(V) iteration
 */
function searchByLemmas(lemmas: string[]): Set<string> {
  const matchingVerses = new Set<string>();

  // Use inverted index if available (O(L) where L = number of lemmas)
  if (lemmaToVerses) {
    const startTime = performance.now();
    for (const lemma of lemmas) {
      const verses = lemmaToVerses.get(lemma);
      if (verses) {
        for (const verseKey of verses) {
          matchingVerses.add(verseKey);
        }
      }
    }
    const endTime = performance.now();
    console.log(`  searchByLemmas (inverted index): ${(endTime - startTime).toFixed(2)}ms for ${lemmas.length} lemmas → ${matchingVerses.size} verses`);
    return matchingVerses;
  }

  // Fallback to linear search if inverted index not available
  console.warn('  searchByLemmas: Using SLOW fallback (inverted index not available)');
  if (!verseLemmas) return matchingVerses;

  const startTime = performance.now();
  for (const [verseKey, verseLemmasList] of Object.entries(verseLemmas)) {
    // Check if this verse contains any of the search lemmas
    if (lemmas.some(lemma => verseLemmasList.includes(lemma))) {
      matchingVerses.add(verseKey);
    }
  }
  const endTime = performance.now();
  console.log(`  searchByLemmas (fallback): ${(endTime - startTime).toFixed(2)}ms → ${matchingVerses.size} verses`);

  return matchingVerses;
}

/**
 * Find the word index in a verse where a lemma appears
 * Returns -1 if not found
 */
function findWordIndexByLemma(verseKey: string, lemmas: string[]): number {
  if (!verseLemmas) return -1;

  const verseLemmasList = verseLemmas[verseKey];
  if (!verseLemmasList) return -1;

  // Find the first word index that has one of our lemmas
  for (let i = 0; i < verseLemmasList.length; i++) {
    if (lemmas.includes(verseLemmasList[i])) {
      return i;
    }
  }

  return -1;
}

/**
 * Get the start and end positions of a word at a given index in the text
 * Words are separated by whitespace
 * Exported for testing
 */
export function getWordBoundaries(text: string, wordIndex: number): { start: number; end: number } | null {
  // Bounds check: wordIndex must be non-negative
  if (wordIndex < 0) return null;

  let currentWord = 0;
  let start = 0;

  // Skip leading whitespace
  while (start < text.length && /\s/.test(text[start])) {
    start++;
  }

  // Find the word at the given index
  while (currentWord < wordIndex && start < text.length) {
    // Skip current word
    while (start < text.length && !/\s/.test(text[start])) {
      start++;
    }
    // Skip whitespace to next word
    while (start < text.length && /\s/.test(text[start])) {
      start++;
    }
    currentWord++;
  }

  if (start >= text.length) return null;

  // Find end of this word
  let end = start;
  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }

  return { start, end };
}

/**
 * Search Hebrew text for whole-word matches only
 * Returns verse indices that match complete words
 */
export function searchHebrewWholeWord(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = normalizeHebrewForSearch(term);

    for (const entry of searchIndex) {
      const words = entry.hebrewText.split(/\s+/);

      // Find word index that matches exactly
      const wordIndex = words.findIndex(word => word === normalizedTerm);

      if (wordIndex !== -1) {
        // Found a match - use getWordBoundaries to find position in original text
        const wordBounds = getWordBoundaries(entry.hebrewOriginal, wordIndex);

        if (wordBounds) {
          const key = `${entry.book}:${entry.chapter}:${entry.verse}`;

          let result = resultMap.get(key);
          if (!result) {
            result = {
              book: entry.book,
              chapter: entry.chapter,
              verse: entry.verse,
              language: 'he',
              matchingTerms: [],
            };
            resultMap.set(key, result);
          }

          // Only add if this term hasn't matched this verse yet
          if (!result.matchingTerms.some(m => m.termIndex === termIndex)) {
            const wordLen = wordBounds.end - wordBounds.start;
            const snippet = createSnippetAtPosition(entry.hebrewOriginal, wordBounds.start, wordLen);
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
  }

  return Array.from(resultMap.values());
}

/**
 * Search Hebrew text by root (lemma) using morphhb Strong's numbers
 * Falls back to whole-word search if lemma is not found
 *
 * @param terms - Array of Hebrew search terms
 * @returns Array of SearchResults with matching verses
 */
function searchByRootMode(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  if (!wordLemmas || !verseLemmas) {
    // No lemma data available, fall back to whole-word search
    return searchHebrewWholeWord(terms);
  }

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
      const t0 = performance.now();
      const matchingVerseKeys = searchByLemmas(lemmas);
      const t1 = performance.now();

      console.log(`  Processing ${matchingVerseKeys.size} matching verses...`);
      let wordIndexTime = 0;
      let wordBoundsTime = 0;
      let snippetTime = 0;
      let mapLookupTime = 0;
      let someCheckTime = 0;
      let otherTime = 0;
      let loopCount = 0;

      for (const verseKey of matchingVerseKeys) {
        const tLoop0 = performance.now();

        // Find the corresponding index entry using fast O(1) map lookup
        const tMap0 = performance.now();
        const entry = verseKeyToEntry.get(verseKey);
        const tMap1 = performance.now();
        mapLookupTime += (tMap1 - tMap0);

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
          const tSome0 = performance.now();
          const shouldAdd = !result.matchingTerms.some(m => m.termIndex === termIndex);
          const tSome1 = performance.now();
          someCheckTime += (tSome1 - tSome0);

          if (shouldAdd) {
            // Find the word that matched via lemma lookup
            const tw0 = performance.now();
            const wordIndex = findWordIndexByLemma(verseKey, lemmas);
            const tw1 = performance.now();
            wordIndexTime += (tw1 - tw0);

            const tb0 = performance.now();
            const wordBounds = wordIndex >= 0 ? getWordBoundaries(entry.hebrewOriginal, wordIndex) : null;
            const tb1 = performance.now();
            wordBoundsTime += (tb1 - tb0);

            if (wordBounds) {
              // Highlight the matched word
              const ts0 = performance.now();
              const wordLen = wordBounds.end - wordBounds.start;
              const snippet = createSnippetAtPosition(entry.hebrewOriginal, wordBounds.start, wordLen);
              const ts1 = performance.now();
              snippetTime += (ts1 - ts0);

              result.matchingTerms.push({
                termIndex,
                snippet: snippet.text,
                matchStart: snippet.matchStart,
                matchEnd: snippet.matchEnd,
              });
            } else {
              // Fallback: try whole-word match
              const wholeWordResults = searchHebrewWholeWord([terms[termIndex]]);
              const wholeWordMatch = wholeWordResults.find(r =>
                r.book === entry.book && r.chapter === entry.chapter && r.verse === entry.verse
              );

              if (wholeWordMatch && wholeWordMatch.matchingTerms.length > 0) {
                // Use the whole-word match snippet
                const match = wholeWordMatch.matchingTerms[0];
                result.matchingTerms.push({
                  termIndex,
                  snippet: match.snippet,
                  matchStart: match.matchStart,
                  matchEnd: match.matchEnd,
                });
              } else {
                // Last resort: no highlighting
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

        const tLoop1 = performance.now();
        const loopIterTime = tLoop1 - tLoop0;
        const measuredTime = (tMap1 - tMap0) + (tSome1 - tSome0);
        otherTime += (loopIterTime - measuredTime);
        loopCount++;
      }

      const t2 = performance.now();
      const totalLoopTime = t2 - t1;
      const accountedTime = wordIndexTime + wordBoundsTime + snippetTime + mapLookupTime + someCheckTime;
      const unaccountedTime = totalLoopTime - accountedTime;

      console.log(`  Timing breakdown for ${matchingVerseKeys.size} verses (${loopCount} iterations):`);
      console.log(`    - searchByLemmas: ${(t1 - t0).toFixed(2)}ms`);
      console.log(`    - Map lookups: ${mapLookupTime.toFixed(2)}ms`);
      console.log(`    - someCheckTime: ${someCheckTime.toFixed(2)}ms`);
      console.log(`    - findWordIndexByLemma: ${wordIndexTime.toFixed(2)}ms`);
      console.log(`    - getWordBoundaries: ${wordBoundsTime.toFixed(2)}ms`);
      console.log(`    - createSnippet: ${snippetTime.toFixed(2)}ms`);
      console.log(`    - Unaccounted: ${unaccountedTime.toFixed(2)}ms ← BOTTLENECK`);
      console.log(`    - Total processing: ${(t2 - t0).toFixed(2)}ms`);
    }

    // If we got results from lemma search, return them
    if (resultMap.size > 0) {
      return Array.from(resultMap.values());
    }
  }

  // No lemmas found for any terms, fall back to whole-word search
  return searchHebrewWholeWord(terms);
}

/**
 * Search for verses matching any of the comma-separated terms
 * Returns ALL matching verses with info about which terms matched
 *
 * For Hebrew: Supports three modes:
 *   - 'substring': substring search (nikkud-insensitive)
 *   - 'word': whole-word matching only
 *   - 'root': lemma-based search via morphhb Strong's numbers (default)
 * For English: Uses substring search (optionally whole-word matching)
 */
export function search(
  query: string,
  wholeWord: boolean = false,
  hebrewMode: 'substring' | 'word' | 'root' = 'substring'
): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // Determine language from first term (all terms use same language)
  const isHebrew = isHebrewQuery(terms[0]);

  // For Hebrew, dispatch based on mode
  if (isHebrew) {
    switch (hebrewMode) {
      case 'word':
        return searchHebrewWholeWord(terms);
      case 'root':
        return searchByRootMode(terms);
      case 'substring':
      default:
        // Fall through to substring search below
        break;
    }
  }

  // Substring search for Hebrew or English
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? normalizeHebrewForSearch(term) : term.toLowerCase();

    for (const entry of searchIndex) {
      // Select appropriate text based on language
      const text = isHebrew ? entry.hebrewText : entry.englishText;
      const original = isHebrew ? entry.hebrewOriginal : entry.englishOriginal;

      // Find matches
      let matches: Array<{ idx: number; len: number }> = [];

      if (!isHebrew && wholeWord) {
        // For English with whole-word matching, use regex
        const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({ idx: match.index, len: match[0].length });
        }
      } else {
        // Simple substring search (for both Hebrew and English)
        const idx = text.indexOf(normalizedTerm);
        if (idx !== -1) {
          matches.push({ idx, len: normalizedTerm.length });
        }
      }

      // Process all matches
      for (const { idx, len } of matches) {
        const key = `${entry.book}:${entry.chapter}:${entry.verse}`;
        const snippet = createSnippet(original, idx, len, isHebrew);

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
 * Create a snippet around a match when we already have positions in the original text
 * (no nikkud mapping needed - used for lemma-based word highlighting)
 */
function createSnippetAtPosition(text: string, matchStart: number, matchLen: number): SnippetResult {
  const maxLen = SEARCH_SNIPPET_MAX_LENGTH;
  const contextBefore = SEARCH_SNIPPET_CONTEXT_BEFORE;

  // Bounds validation: ensure matchEnd doesn't exceed text length
  const matchEnd = Math.min(matchStart + matchLen, text.length);

  let start = Math.max(0, matchStart - contextBefore);
  let end = Math.min(text.length, start + maxLen);

  // Adjust start if we're near the end
  if (end === text.length && end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  const adjustedMatchStart = matchStart - start;
  const adjustedMatchEnd = matchEnd - start;

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
 * Map a position in nikkud-stripped text to the corresponding position in original text
 */
function mapStrippedToOriginal(original: string, strippedPos: number): number {
  // Bounds check: strippedPos must be non-negative
  if (strippedPos < 0) return 0;

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
  // Bounds check: start must be within valid range
  if (start < 0 || start >= text.length) return 0;
  // Bounds check: strippedLen must be non-negative
  if (strippedLen < 0) return 0;

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
  const maxLen = SEARCH_SNIPPET_MAX_LENGTH;
  const contextBefore = SEARCH_SNIPPET_CONTEXT_BEFORE;

  // For Hebrew, map stripped positions to original positions
  let origMatchStart = matchIdx;
  let origMatchEnd = matchIdx + matchLen;

  if (isHebrew) {
    origMatchStart = mapStrippedToOriginal(text, matchIdx);
    const nikkudInMatch = countNikkudInRange(text, origMatchStart, matchLen);
    // Bounds validation: ensure origMatchEnd doesn't exceed text length
    origMatchEnd = Math.min(origMatchStart + matchLen + nikkudInMatch, text.length);
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
