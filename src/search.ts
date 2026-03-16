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
  snippet?: string;
  matchStart?: number;
  matchEnd?: number;
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

// Reverse map: medial form → final form (for display)
const MEDIAL_TO_FINAL_MAP: Record<string, string> = {
  'כ': 'ך',
  'מ': 'ם',
  'נ': 'ן',
  'פ': 'ף',
  'צ': 'ץ',
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
// Adjacency map: Strong's number -> Set of directly connected Strong's numbers
// Two Strong's numbers are adjacent if they co-occur as lemmas for the same
// surface form (with exactly 2 lemmas) in word-lemmas. NOT transitive.
let lemmaAdjacency: Map<string, Set<string>> | null = null;
// Reverse lookup: Strong's number -> shortest surface form that maps to it
// Used to generate searchable terms when related-root chips are clicked
let strongsToSurfaceForm: Map<string, string> | null = null;
// Reverse lookup: normalized root text -> Strong's numbers
// Used when user types a bare root form that isn't itself a surface form
let rootToStrongsNumbers: Map<string, string[]> | null = null;

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
      // Normalize maqaf (U+05BE ־), hyphens, and other non-letter Hebrew
      // punctuation (paseq, sof pasuq, nun hafukha) to spaces so that
      // keyboard space matches any word separator (e.g. "את יצחק" matches "את־יצחק")
      if (code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6 || char === '-') {
        result += ' ';
      } else {
        // Normalize final forms to regular forms
        result += FINAL_FORM_MAP[char] || char;
      }
    }
  }
  return result;
}

/**
 * Convert medial-only Hebrew text to proper display form by restoring
 * final letters (sofit) at word endings: כ→ך, מ→ם, נ→ן, פ→ף, צ→ץ
 */
export function toDisplayHebrew(text: string): string {
  return text.replace(/\S+/g, word => {
    const chars = [...word];
    const last = chars[chars.length - 1];
    const finalForm = MEDIAL_TO_FINAL_MAP[last];
    if (finalForm) {
      chars[chars.length - 1] = finalForm;
    }
    return chars.join('');
  });
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

      console.log(`✓ Loaded: ${Object.keys(wordLemmas || {}).length} words, ${Object.keys(verseLemmas || {}).length} verses, ${Object.keys(strongsToRoot || {}).length} Strong's numbers`);

      // Build inverted index: Strong's number -> Set of verse keys
      // This converts O(V) search-by-lemma to O(1) lookup
      buildLemmaInvertedIndex();

      // Build adjacency map: direct neighbors from 2-lemma surface forms
      buildLemmaAdjacency();

      // Build reverse root index: root text -> Strong's numbers
      buildRootToStrongsIndex();
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
 * Build adjacency map from wordLemmas.
 * Two Strong's numbers are adjacent if they co-occur as lemmas for the same
 * surface form (restricted to forms with exactly 2 lemmas to avoid ambiguity).
 *
 * Unlike the old union-find approach, this is NOT transitive:
 * if A-B share a form and B-C share a different form, A and C are NOT linked.
 * Instead, related roots are surfaced as clickable UI suggestions.
 *
 * Also builds strongsToSurfaceForm: for each Strong's number, keeps the
 * shortest surface form that maps to it (for generating search terms).
 */
function buildLemmaAdjacency(): void {
  if (!wordLemmas) {
    lemmaAdjacency = null;
    strongsToSurfaceForm = null;
    return;
  }

  const startTime = performance.now();

  lemmaAdjacency = new Map();
  strongsToSurfaceForm = new Map();

  for (const [surfaceForm, lemmas] of Object.entries(wordLemmas)) {
    // Track shortest surface form per Strong's number
    for (const lemma of lemmas) {
      const existing = strongsToSurfaceForm.get(lemma);
      if (!existing || surfaceForm.length < existing.length) {
        strongsToSurfaceForm.set(lemma, surfaceForm);
      }
    }

    // Only build adjacency from forms with exactly 2 lemmas
    if (lemmas.length !== 2) continue;

    const [a, b] = lemmas;

    let neighborsA = lemmaAdjacency.get(a);
    if (!neighborsA) {
      neighborsA = new Set();
      lemmaAdjacency.set(a, neighborsA);
    }
    neighborsA.add(b);

    let neighborsB = lemmaAdjacency.get(b);
    if (!neighborsB) {
      neighborsB = new Set();
      lemmaAdjacency.set(b, neighborsB);
    }
    neighborsB.add(a);
  }

  const endTime = performance.now();
  const withNeighbors = [...lemmaAdjacency.values()].filter(s => s.size > 0).length;
  console.log(`✓ Built lemma adjacency: ${withNeighbors} lemmas with neighbors in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Build reverse index from normalized root text -> Strong's numbers.
 * Enables lookup when user types a bare root form (e.g. בסס) that isn't
 * itself a surface form in word-lemmas.json.
 */
function buildRootToStrongsIndex(): void {
  if (!strongsToRoot) {
    rootToStrongsNumbers = null;
    return;
  }

  const startTime = performance.now();
  rootToStrongsNumbers = new Map();

  for (const [strongsNum, root] of Object.entries(strongsToRoot)) {
    const normalized = normalizeHebrewForSearch(root);
    let list = rootToStrongsNumbers.get(normalized);
    if (!list) {
      list = [];
      rootToStrongsNumbers.set(normalized, list);
    }
    list.push(strongsNum);
  }

  const endTime = performance.now();
  console.log(`✓ Built root→Strong's index: ${rootToStrongsNumbers.size} unique roots in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Try to find Strong's numbers (lemmas) for a Hebrew word.
 *
 * Strategy: prefer interpretations that use more of the input.
 * 1. Exact surface form lookup (word literally appears in the text)
 * 2. Root reverse lookup (user typed a bare root)
 * 3. Prefix stripping (longest first), retrying both surface + root lookup
 *    on the remainder at each level
 *
 * Exported for use in overlay UI to show which terms have lemma data
 */
export function findLemmasForWord(hebrewWord: string): string[] | null {
  if (!wordLemmas) {
    console.log(`findLemmasForWord("${hebrewWord}"): wordLemmas is null`);
    return null;
  }

  // word-lemmas keys are medial-only (finals normalized at generation time),
  // so we normalize to medial here to match
  const normalized = normalizeHebrewForSearch(hebrewWord);
  console.log(`findLemmasForWord("${hebrewWord}") normalized to "${normalized}"`);

  // Try the full input as-is (surface form, then root)
  const fullResult = lookupSurfaceOrRoot(normalized);
  if (fullResult) return fullResult;

  // Try stripping prefixes (longest first), retrying both lookups on remainder.
  // Two-letter combos first, then single-letter.
  for (const prefix of HEBREW_PREFIX_COMBOS) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 1) {
      const remainder = normalized.slice(prefix.length);
      const result = lookupSurfaceOrRoot(remainder);
      if (result) {
        console.log(`  ✓ Found after stripping prefix "${prefix}"`);
        return result;
      }
    }
  }

  for (const prefix of HEBREW_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > 2) {
      const remainder = normalized.slice(prefix.length);
      const result = lookupSurfaceOrRoot(remainder);
      if (result) {
        console.log(`  ✓ Found after stripping prefix "${prefix}"`);
        return result;
      }
    }
  }

  console.log(`  ✗ No lemmas found`);
  return null;
}

/**
 * Try to find lemmas for a normalized Hebrew string, first as a surface form
 * in word-lemmas, then as a root (exact or prefix) in strongs-to-root.
 */
function lookupSurfaceOrRoot(term: string): string[] | null {
  // Surface form lookup
  if (wordLemmas && wordLemmas[term]) {
    console.log(`  ✓ Surface form "${term}": ${wordLemmas[term].length} lemmas`);
    return wordLemmas[term];
  }

  // Root reverse lookup
  if (rootToStrongsNumbers) {
    const exact = rootToStrongsNumbers.get(term);
    if (exact && exact.length > 0) {
      console.log(`  ✓ Root match "${term}" (exact): ${exact.length} Strong's numbers`);
      return exact;
    }

    // Try as prefix of root forms (e.g. בסס matches root בססו)
    const prefixMatches: string[] = [];
    for (const [root, strongsNums] of rootToStrongsNumbers) {
      if (root.startsWith(term) && root !== term) {
        prefixMatches.push(...strongsNums);
      }
    }
    if (prefixMatches.length > 0) {
      console.log(`  ✓ Root match "${term}" (prefix): ${prefixMatches.length} Strong's numbers`);
      return prefixMatches;
    }
  }

  return null;
}

/**
 * Get the Hebrew root for a Strong's number (display form with proper finals)
 * Exported for use in overlay UI to show which root was matched
 */
export function getRootForStrongsNumber(strongsNum: string): string | null {
  if (!strongsToRoot) return null;
  const root = strongsToRoot[strongsNum];
  return root ? toDisplayHebrew(root) : null;
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
 * Test if a character is a word separator (whitespace, maqaf, or other
 * Hebrew punctuation that normalizeHebrewForSearch converts to space)
 */
function isWordSeparator(char: string): boolean {
  if (/\s/.test(char)) return true;
  const code = char.charCodeAt(0);
  return code === 0x05BE || code === 0x05C0 || code === 0x05C3 || code === 0x05C6 || char === '-';
}

/**
 * Get the start and end positions of a word at a given index in the text
 * Words are separated by whitespace, maqaf (U+05BE), and other Hebrew punctuation
 * Exported for testing
 */
export function getWordBoundaries(text: string, wordIndex: number): { start: number; end: number } | null {
  // Bounds check: wordIndex must be non-negative
  if (wordIndex < 0) return null;

  let currentWord = 0;
  let start = 0;

  // Skip leading separators
  while (start < text.length && isWordSeparator(text[start])) {
    start++;
  }

  // Find the word at the given index
  while (currentWord < wordIndex && start < text.length) {
    // Skip current word
    while (start < text.length && !isWordSeparator(text[start])) {
      start++;
    }
    // Skip separators to next word
    while (start < text.length && isWordSeparator(text[start])) {
      start++;
    }
    currentWord++;
  }

  if (start >= text.length) return null;

  // Find end of this word
  let end = start;
  while (end < text.length && !isWordSeparator(text[end])) {
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
 * Lazily compute snippet/highlighting for a specific search result
 * Call this only when the result needs to be displayed
 *
 * @param result - The search result to compute snippet for
 * @param termIndex - Index of the matching term
 * @param searchTerm - The original search term
 * @returns Snippet data or null if verse not found
 */
export function computeSnippetForMatch(
  result: SearchResult,
  _termIndex: number,
  searchTerm: string
): { snippet: string; matchStart: number; matchEnd: number } | null {
  // Find verse text
  const verseKey = `${result.book}:${result.chapter}:${result.verse}`;
  const entry = verseKeyToEntry.get(verseKey);
  if (!entry) return null;

  // Try lemma-based search first
  const lemmas = findLemmasForWord(searchTerm);
  if (lemmas && lemmas.length > 0) {
    // Search the whitespace-split text for a word containing the root.
    // We can't use findWordIndexByLemma here because morphhb word indices
    // don't align with whitespace indices (maqaf-joined words like "בני־יוסף"
    // are one whitespace token but multiple morphhb segments).
    const words = entry.hebrewText.split(/\s+/);
    let wordIndex = -1;

    // Try each lemma's root text as a substring within whitespace words
    for (const lemma of lemmas) {
      const root = strongsToRoot?.[lemma];
      if (root) {
        wordIndex = words.findIndex(w => w.includes(root));
        if (wordIndex >= 0) break;
      }
    }

    // Fallback: try the search term itself
    if (wordIndex < 0) {
      const normalizedSearch = normalizeHebrewForSearch(searchTerm);
      wordIndex = words.findIndex(w => w.includes(normalizedSearch));
    }

    if (wordIndex >= 0) {
      const wordBounds = getWordBoundaries(entry.hebrewOriginal, wordIndex);
      if (wordBounds) {
        const wordLen = wordBounds.end - wordBounds.start;
        const snippet = createSnippetAtPosition(entry.hebrewOriginal, wordBounds.start, wordLen);
        return {
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
        };
      }
    }
  }

  // Fallback to whole-word matching (when no lemmas or lemma search failed)
  const normalizedTerm = normalizeHebrewForSearch(searchTerm);
  const words = entry.hebrewText.split(/\s+/);
  const wordIndex = words.findIndex(word => word === normalizedTerm);

  if (wordIndex !== -1) {
    // Found whole-word match - get position in original text
    const wordBounds = getWordBoundaries(entry.hebrewOriginal, wordIndex);
    if (wordBounds) {
      const wordLen = wordBounds.end - wordBounds.start;
      const snippet = createSnippetAtPosition(entry.hebrewOriginal, wordBounds.start, wordLen);
      return {
        snippet: snippet.text,
        matchStart: snippet.matchStart,
        matchEnd: snippet.matchEnd,
      };
    }
  }

  // Last resort fallback: no highlighting
  return {
    snippet: entry.hebrewOriginal.slice(0, 60) + (entry.hebrewOriginal.length > 60 ? '...' : ''),
    matchStart: 0,
    matchEnd: 0,
  };
}

/**
 * Represents a related root that can be shown as a clickable chip in the UI
 */
export interface RelatedRoot {
  strongsNum: string;
  rootText: string;       // Hebrew root from strongs-to-root.json
  surfaceForm: string;    // representative word for searching
}

/**
 * Get depth-1 neighbors for a set of lemmas from the adjacency map.
 * Returns related roots (neighbors not in the input set), deduplicated by rootText.
 * Used for showing clickable "Related:" chips in the search legend.
 */
export function getRelatedRoots(lemmas: string[]): RelatedRoot[] {
  if (!lemmaAdjacency || !strongsToRoot || !strongsToSurfaceForm) return [];

  const inputSet = new Set(lemmas);
  const seen = new Set<string>(); // deduplicate by rootText
  const related: RelatedRoot[] = [];

  for (const lemma of lemmas) {
    const neighbors = lemmaAdjacency.get(lemma);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (inputSet.has(neighbor)) continue;

      const rootText = strongsToRoot[neighbor];
      if (!rootText || seen.has(rootText)) continue;

      const surfaceForm = strongsToSurfaceForm.get(neighbor);
      if (!surfaceForm) continue;

      seen.add(rootText);
      related.push({ strongsNum: neighbor, rootText, surfaceForm });
    }
  }

  return related;
}

/**
 * Search Hebrew text by root (lemma) using morphhb Strong's numbers
 * Falls back to whole-word search if lemma is not found
 *
 * @param terms - Array of Hebrew search terms
 * @returns Array of SearchResults with matching verses (snippets NOT computed - use computeSnippetForMatch)
 */
function searchByRootMode(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  if (!wordLemmas || !verseLemmas) {
    // No lemma data available, fall back to whole-word search (lazy version)
    return searchHebrewWholeWordLazy(terms);
  }

  const termLemmas: Array<{ termIndex: number; lemmas: string[] }> = [];

  // Collect lemmas for each search term (direct lemmas only, no cluster expansion)
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
        // Find the corresponding index entry using fast O(1) map lookup
        const entry = verseKeyToEntry.get(verseKey);

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
          const shouldAdd = !result.matchingTerms.some(m => m.termIndex === termIndex);

          if (shouldAdd) {
            // Only track that this term matched - NO SNIPPET COMPUTATION
            result.matchingTerms.push({
              termIndex,
              // snippet, matchStart, matchEnd omitted (will be computed lazily)
            });
          }
        }
      }
    }

    // If we got results from lemma search, return them
    if (resultMap.size > 0) {
      return Array.from(resultMap.values());
    }
  }

  // No lemmas found for any terms, fall back to whole-word search (lazy version)
  return searchHebrewWholeWordLazy(terms);
}

/**
 * Search Hebrew text for whole-word matches only (LAZY - no snippets computed)
 * Returns verse indices that match complete words
 * Snippets must be computed on-demand with computeSnippetForMatch
 */
function searchHebrewWholeWordLazy(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = normalizeHebrewForSearch(term);

    for (const entry of searchIndex) {
      const words = entry.hebrewText.split(/\s+/);

      // Find word index that matches exactly
      const wordIndex = words.findIndex(word => word === normalizedTerm);

      if (wordIndex !== -1) {
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
          // Only track that this term matched - NO SNIPPET COMPUTATION
          result.matchingTerms.push({
            termIndex,
            // snippet, matchStart, matchEnd omitted (will be computed lazily)
          });
        }
      }
    }
  }

  return Array.from(resultMap.values());
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
