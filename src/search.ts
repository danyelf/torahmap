// Full-text search with word-wheeling support for Hebrew and English
// Hebrew root search resolves written forms to ETCBC BHSA lexemes

import type { VerseTexts } from './verseTexts';
import { getBookOrder } from './constants/books.ts';
import { tanakhKey } from './types.ts';
import {
  fetchData,
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

// Common Hebrew prefixes that can be stripped when resolving a word to its lexeme
const HEBREW_PREFIXES = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש'];
// Two-letter prefix combinations
const HEBREW_PREFIX_COMBOS = ['וב', 'וה', 'ול', 'וכ', 'ומ', 'וש', 'מה', 'שב', 'של', 'בה'];

let searchIndex: IndexEntry[] = [];
// Fast lookup map: verse key -> index entry (avoids O(n) find() calls)
let verseKeyToEntry: Map<string, IndexEntry> = new Map();

/**
 * A lexeme is a dictionary entry: one word of Hebrew or Aramaic, with its own
 * meaning. Words that happen to be spelled alike are separate lexemes, so the
 * preposition "upon" and the verb "ascend" never get mixed together.
 *
 * Lexemes are referred to by their position in the loaded dictionary.
 */
export type LexemeId = number;

export interface Lexeme {
  /** ETCBC identifier, e.g. "BR>[" for the verb ברא */
  id: string;
  /** vocalized dictionary form, for display */
  form: string;
  /** English gloss */
  gloss: string;
  /** part of speech: verb, subs, nmpr, prep, ... */
  pos: string;
  language: 'heb' | 'arc';
  /** derivational root, in ETCBC transliteration, where BHSA records one */
  root: string | null;
}

// The dictionary, loaded from lexicon.json.
let lexicon: Lexeme[] | null = null;
// Parts of speech left out of related-word suggestions (articles, conjunctions,
// prepositions and the like make useless suggestions).
let functionWordPos: Set<string> = new Set();
// Consonantal spelling of each lexeme's dictionary form, in the same shape the
// search box produces. Parallel to `lexicon`.
let lexemeSpellings: string[] = [];

// Written form (nikkud stripped, finals folded) -> the lexemes it can be,
// likeliest reading first.
let formToLexemes: Record<string, LexemeId[]> | null = null;
// Verse key -> the lexemes occurring in that verse.
let verseToLexemes: Record<string, LexemeId[]> | null = null;

// Inverted index: lexeme -> the verses it occurs in. Turns a root-mode search
// into one lookup per lexeme instead of a scan over every verse.
let lexemeToVerses: Map<LexemeId, Set<string>> | null = null;
// Root family: lexeme -> every lexeme sharing its derivational root.
let lexemeFamilies: Map<LexemeId, LexemeId[]> | null = null;
// Lexeme -> a written form that will find it again, for the related-word chips.
let lexemeToSearchForm: Map<LexemeId, string> | null = null;
// Consonantal dictionary spelling -> lexemes, for readers who type a bare root
// that never appears on its own in the text.
let spellingToLexemes: Map<string, LexemeId[]> | null = null;

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

/** Row order of the lexeme records in lexicon.json */
type LexemeRow = [
  id: string,
  form: string,
  gloss: string,
  pos: string,
  language: 'heb' | 'arc',
  root: string | null,
];

interface LexiconFile {
  source: string;
  fields: string[];
  functionWordPos: string[];
  lexemes: LexemeRow[];
}

/**
 * Load the lexeme index (called during initialization).
 *
 * Three files: the dictionary itself, written form -> lexeme, and
 * verse -> lexeme. Everything else is derived from those here.
 */
export async function loadLexiconData(): Promise<void> {
  try {
    console.log('Loading lexeme index...');
    const [lexiconRes, formsRes, versesRes] = await Promise.all([
      fetchData('lexicon.json'),
      fetchData('word-lexemes.json'),
      fetchData('verse-lexemes.json'),
    ]);

    if (!lexiconRes.ok || !formsRes.ok || !versesRes.ok) {
      console.warn('Failed to load lexeme index, falling back to whole-word search');
      console.warn(`Response status: lexicon=${lexiconRes.status}, forms=${formsRes.status}, verses=${versesRes.status}`);
      return;
    }

    const lexiconFile: LexiconFile = await lexiconRes.json();
    formToLexemes = await formsRes.json();
    verseToLexemes = await versesRes.json();

    lexicon = lexiconFile.lexemes.map(([id, form, gloss, pos, language, root]) => ({
      id, form, gloss, pos, language, root,
    }));
    functionWordPos = new Set(lexiconFile.functionWordPos ?? []);
    lexemeSpellings = lexicon.map(entry => normalizeHebrewForSearch(entry.form));

    console.log(
      `✓ Loaded ${lexicon.length} lexemes (${lexiconFile.source}), ` +
      `${Object.keys(formToLexemes || {}).length} written forms, ` +
      `${Object.keys(verseToLexemes || {}).length} verses`
    );

    buildVerseIndex();
    buildSpellingIndex();
    buildRootFamilies();
    buildSearchForms();
  } catch (err) {
    console.warn('Error loading lexeme index:', err);
  }
}

/**
 * Invert verse -> lexemes into lexeme -> verses, so a root-mode search costs
 * one lookup per lexeme rather than a pass over all 23,000 verses.
 */
function buildVerseIndex(): void {
  if (!verseToLexemes) {
    lexemeToVerses = null;
    return;
  }

  const startTime = performance.now();
  lexemeToVerses = new Map();

  for (const [verseKey, lexemes] of Object.entries(verseToLexemes)) {
    for (const lexeme of lexemes) {
      let verses = lexemeToVerses.get(lexeme);
      if (!verses) {
        verses = new Set();
        lexemeToVerses.set(lexeme, verses);
      }
      verses.add(verseKey);
    }
  }

  const endTime = performance.now();
  console.log(`✓ Built verse index: ${lexemeToVerses.size} lexemes in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Index lexemes by the consonants of their dictionary form, so that a reader
 * who types a bare root (בסס) finds it even though that spelling never stands
 * alone in the text.
 */
function buildSpellingIndex(): void {
  if (!lexicon) {
    spellingToLexemes = null;
    return;
  }

  spellingToLexemes = new Map();
  for (let id = 0; id < lexicon.length; id++) {
    const spelling = lexemeSpellings[id];
    if (!spelling) continue;
    let list = spellingToLexemes.get(spelling);
    if (!list) {
      list = [];
      spellingToLexemes.set(spelling, list);
    }
    list.push(id);
  }
  console.log(`✓ Built spelling index: ${spellingToLexemes.size} distinct dictionary spellings`);
}

/**
 * Group lexemes into root families for the "Related" suggestions.
 *
 * Two lexemes belong to the same family when they share a derivational root:
 * the root BHSA records for the lexeme, or, where BHSA records none, the
 * lexeme's own consonantal skeleton with its part-of-speech marker removed.
 * BHSA's homograph markers are deliberately kept, so דָּבָר "word" and דבר
 * "speak" are family but דֶּבֶר "pest" is not.
 *
 * Families are per language, and function words are left out: nobody wants
 * "the" suggested as a related word.
 */
function buildRootFamilies(): void {
  if (!lexicon) {
    lexemeFamilies = null;
    return;
  }

  const startTime = performance.now();
  const byRoot = new Map<string, LexemeId[]>();

  for (let id = 0; id < lexicon.length; id++) {
    const entry = lexicon[id];
    if (functionWordPos.has(entry.pos)) continue;
    // "/" marks a noun and "[" a verb in ETCBC lexeme ids; both are notation,
    // not part of the word.
    const skeleton = entry.root ?? entry.id.replace(/[/[]/g, '');
    const key = `${skeleton}|${entry.language}`;
    let family = byRoot.get(key);
    if (!family) {
      family = [];
      byRoot.set(key, family);
    }
    family.push(id);
  }

  lexemeFamilies = new Map();
  let families = 0;
  for (const family of byRoot.values()) {
    if (family.length < 2) continue;
    families++;
    for (const id of family) {
      lexemeFamilies.set(id, family);
    }
  }

  const endTime = performance.now();
  console.log(`✓ Built root families: ${lexemeFamilies.size} lexemes in ${families} families in ${(endTime - startTime).toFixed(2)}ms`);
}

/**
 * Pick, for each lexeme, a written form that will find it again when a related
 * word chip is clicked. Prefer a form whose likeliest reading is this lexeme,
 * and among those the shortest.
 */
function buildSearchForms(): void {
  if (!formToLexemes) {
    lexemeToSearchForm = null;
    return;
  }

  lexemeToSearchForm = new Map();
  const unambiguous = new Set<LexemeId>();

  for (const [form, lexemes] of Object.entries(formToLexemes)) {
    for (let rank = 0; rank < lexemes.length; rank++) {
      const id = lexemes[rank];
      const isBestReading = rank === 0;
      const existing = lexemeToSearchForm.get(id);
      const existingIsBest = unambiguous.has(id);

      if (existing === undefined) {
        lexemeToSearchForm.set(id, form);
        if (isBestReading) unambiguous.add(id);
      } else if (isBestReading && !existingIsBest) {
        lexemeToSearchForm.set(id, form);
        unambiguous.add(id);
      } else if (isBestReading === existingIsBest && form.length < existing.length) {
        lexemeToSearchForm.set(id, form);
      }
    }
  }
}

/**
 * Find the lexemes a written Hebrew word can be.
 *
 * Prefer readings that account for more of what was typed:
 * 1. the word exactly as it appears in the text
 * 2. a bare dictionary spelling (the reader typed a root)
 * 3. the same two lookups again after stripping a prefix, longest first
 *
 * Exported so the search overlay can tell which terms resolved to a lexeme.
 */
export function findLexemesForWord(hebrewWord: string): LexemeId[] | null {
  if (!formToLexemes) return null;

  // word-lexemes keys fold final letters to their medial shape, so the query
  // has to be folded the same way.
  const normalized = normalizeHebrewForSearch(hebrewWord);

  const direct = lookupFormOrSpelling(normalized);
  if (direct) return direct;

  // Two-letter prefix combinations first, then single letters.
  for (const prefix of HEBREW_PREFIX_COMBOS) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 1) {
      const result = lookupFormOrSpelling(normalized.slice(prefix.length));
      if (result) return result;
    }
  }

  for (const prefix of HEBREW_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > 2) {
      const result = lookupFormOrSpelling(normalized.slice(prefix.length));
      if (result) return result;
    }
  }

  return null;
}

/**
 * Look a normalized Hebrew string up as a written form first, then as a bare
 * dictionary spelling (exact, then as the start of a longer spelling).
 */
function lookupFormOrSpelling(term: string): LexemeId[] | null {
  if (formToLexemes && formToLexemes[term]) {
    return formToLexemes[term];
  }

  if (spellingToLexemes) {
    const exact = spellingToLexemes.get(term);
    if (exact && exact.length > 0) return exact;

    const prefixMatches: LexemeId[] = [];
    for (const [spelling, lexemes] of spellingToLexemes) {
      if (spelling.startsWith(term) && spelling !== term) {
        prefixMatches.push(...lexemes);
      }
    }
    if (prefixMatches.length > 0) return prefixMatches;
  }

  return null;
}

/**
 * Look up a lexeme's dictionary record: display form, English gloss, part of
 * speech and language.
 */
export function getLexeme(id: LexemeId): Lexeme | null {
  return lexicon?.[id] ?? null;
}

/**
 * The vocalized Hebrew form of a lexeme, for showing which word was matched.
 */
export function getLexemeForm(id: LexemeId): string | null {
  return lexicon?.[id]?.form ?? null;
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

  // Fallback to verseTexts keys for tests that build an index without loading full app data
  let books: readonly string[];
  try {
    books = getBookOrder();
  } catch {
    books = Object.keys(verseTexts);
  }
  for (const book of books) {
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
 * Verse keys containing any of the given lexemes.
 * Uses the inverted index, so one lookup per lexeme rather than a full scan.
 */
function searchByLexemes(lexemes: LexemeId[]): Set<string> {
  const matchingVerses = new Set<string>();

  if (lexemeToVerses) {
    for (const lexeme of lexemes) {
      const verses = lexemeToVerses.get(lexeme);
      if (verses) {
        for (const verseKey of verses) {
          matchingVerses.add(verseKey);
        }
      }
    }
    return matchingVerses;
  }

  // The inverted index is built at load time, so this only runs if loading
  // failed partway through.
  if (!verseToLexemes) return matchingVerses;
  for (const [verseKey, verseLexemes] of Object.entries(verseToLexemes)) {
    if (lexemes.some(lexeme => verseLexemes.includes(lexeme))) {
      matchingVerses.add(verseKey);
    }
  }
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

  // Try lexeme-based highlighting first
  const lexemes = findLexemesForWord(searchTerm);
  if (lexemes && lexemes.length > 0) {
    // Find the word in the verse that resolves to one of the same lexemes.
    // Positions cannot be taken from the index: BHSA splits prefixes into
    // separate words, so its word numbering does not line up with the
    // whitespace tokens of the displayed text.
    const wanted = new Set(lexemes);
    const words = entry.hebrewText.split(/\s+/);
    const normalizedSearch = normalizeHebrewForSearch(searchTerm);

    // Prefer the word the reader actually typed. A verse can hold several
    // words that share a reading with the term, and highlighting the one
    // spelled the same is the least surprising choice.
    let wordIndex = words.indexOf(normalizedSearch);

    if (wordIndex < 0) {
      wordIndex = words.findIndex(word => {
        const wordLexemes = findLexemesForWord(word);
        return wordLexemes !== null && wordLexemes.some(id => wanted.has(id));
      });
    }

    if (wordIndex < 0) {
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

  // Fallback to whole-word matching (when the term resolved to no lexeme, or
  // no word in the verse matched one)
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
 * A word from the same root family, offered as a clickable chip in the UI.
 */
export interface RelatedLexeme {
  lexemeId: LexemeId;
  form: string;        // vocalized Hebrew, shown on the chip
  gloss: string;       // English gloss, shown on hover
  searchForm: string;  // a written form that will find it
}

/**
 * Words sharing a derivational root with the searched lexemes.
 *
 * Lexemes the search already resolved to are left out — those are readings of
 * what was typed, not related words. The result is deduplicated by dictionary
 * form and ordered so that the words the reader is likeliest to recognize come
 * first (more frequent lexemes have lower indices in BHSA's dictionary order,
 * which follows first occurrence, so we sort by how many verses each occurs in).
 */
export function getRelatedLexemes(lexemes: LexemeId[]): RelatedLexeme[] {
  if (!lexemeFamilies || !lexicon || !lexemeToSearchForm) return [];

  const searched = new Set(lexemes);
  const seen = new Set<string>();
  const related: RelatedLexeme[] = [];

  for (const lexeme of lexemes) {
    const family = lexemeFamilies.get(lexeme);
    if (!family) continue;

    for (const relative of family) {
      if (searched.has(relative)) continue;

      const entry = lexicon[relative];
      if (!entry || seen.has(entry.form)) continue;

      const searchForm = lexemeToSearchForm.get(relative);
      if (!searchForm) continue;

      seen.add(entry.form);
      related.push({
        lexemeId: relative,
        form: entry.form,
        gloss: entry.gloss,
        searchForm,
      });
    }
  }

  related.sort((a, b) =>
    (lexemeToVerses?.get(b.lexemeId)?.size ?? 0) - (lexemeToVerses?.get(a.lexemeId)?.size ?? 0)
  );
  return related;
}

/**
 * Search Hebrew text by lexeme, so that every inflected form of a word is found.
 * Falls back to whole-word search when nothing in the text resolves the term.
 *
 * @param terms - Array of Hebrew search terms
 * @returns Array of SearchResults with matching verses (snippets NOT computed - use computeSnippetForMatch)
 */
function searchByRootMode(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  if (!formToLexemes || !verseToLexemes) {
    // No lexeme data available, fall back to whole-word search (lazy version)
    return searchHebrewWholeWordLazy(terms);
  }

  const termLexemes: Array<{ termIndex: number; lexemes: LexemeId[] }> = [];

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const lexemes = findLexemesForWord(terms[termIndex]);
    if (lexemes && lexemes.length > 0) {
      termLexemes.push({ termIndex, lexemes });
    }
  }

  if (termLexemes.length > 0) {
    for (const { termIndex, lexemes } of termLexemes) {
      const matchingVerseKeys = searchByLexemes(lexemes);

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

    // If we got results from lexeme search, return them
    if (resultMap.size > 0) {
      return Array.from(resultMap.values());
    }
  }

  // No lexemes found for any term, fall back to whole-word search (lazy version)
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
 *   - 'root': lexeme-based search via the ETCBC BHSA index (default)
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
 * (no nikkud mapping needed - used for lexeme-based word highlighting)
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
    const key = tanakhKey(r.book, r.chapter, r.verse);
    map.set(key, r.matchingTerms.map(m => m.termIndex));
  }
  return map;
}
