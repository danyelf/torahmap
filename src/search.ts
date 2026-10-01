// Full-text search over Hebrew and English.
// Meanings mode resolves a written form to the ETCBC BHSA lexemes it can be.

import type { VerseTexts } from './verseTexts';
import { getBookOrder } from './constants/books.ts';
import { HEBREW, tanakhKey } from './types.ts';

import { fetchData } from './constants.ts';
import {
  TERM_SEPARATORS,
  SEARCH_SNIPPET_MAX_LENGTH,
  SEARCH_SNIPPET_CONTEXT_BEFORE,
} from './search/constants.ts';
import { isSearchableWord, normalizeHebrewForSearch } from './hebrew.ts';
import { foldForMatching, matchRangesInFolded, type MatchMode } from './search/matching.ts';
import type { TextLanguage } from './types.ts';

export interface TermMatch {
  termIndex: number;
}

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  matchingTerms: TermMatch[];
}

interface IndexEntry {
  book: string;
  chapter: number;
  verse: number;
  hebrewText: string; // folded for matching: no points, finals and separators normalized
  hebrewOriginal: string; // original for display
  englishText: string; // lowercased
  englishOriginal: string; // original for display
}

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

/** Hebrew or Aramaic, as ETCBC writes them. */
export type LexemeLanguage = 'heb' | 'arc';

export interface Lexeme {
  /** ETCBC identifier, e.g. "BR>[" for the verb ברא */
  id: string;
  /** vocalized dictionary form, for display */
  form: string;
  /** English gloss */
  gloss: string;
  /** part of speech: verb, subs, nmpr, prep, ... */
  pos: string;
  language: LexemeLanguage;
}

// The dictionary, loaded from lexicon.json.
let lexicon: Lexeme[] | null = null;
// Consonantal spelling of each lexeme's dictionary form, in the same shape the
// search box produces. Parallel to `lexicon`.
let lexemeSpellings: string[] = [];

// Written form (nikkud stripped, finals folded) -> the lexemes it can be,
// likeliest reading first.
let formToLexemes: Record<string, LexemeId[]> | null = null;
// Verse key -> the lexemes occurring in that verse.
let verseToLexemes: Record<string, LexemeId[]> | null = null;

// Inverted index: lexeme -> the verses it occurs in. Turns a meanings-mode search
// into one lookup per lexeme instead of a scan over every verse.
let lexemeToVerses: Map<LexemeId, Set<string>> | null = null;
// Consonantal dictionary spelling -> lexemes, for readers who type a bare root
// that never appears on its own in the text.
let spellingToLexemes: Map<string, LexemeId[]> | null = null;
// Each lexeme's commonest spelling, as printed. Parallel to `lexicon`.
let printedSpellings: string[] = [];

/** The terms a query string names, dropping ones too short to search on. */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(TERM_SEPARATORS)
    .map((t) => t.trim())
    .filter(isSearchableWord);
}

/** A lexeme as lexicon.json writes it, in the order generate-lexeme-index.py writes. */
type LexemeRow = [
  id: string,
  form: string,
  gloss: string,
  pos: string,
  language: LexemeLanguage,
  printed: string,
];

interface LexiconFile {
  source: string;
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
      fetchData('search/lexicon.json'),
      fetchData('search/word-lexemes.json'),
      fetchData('search/verse-lexemes.json'),
    ]);

    if (!lexiconRes.ok || !formsRes.ok || !versesRes.ok) {
      console.error(
        'Failed to load the lexeme index; meanings search will find nothing. ' +
          `Response status: lexicon=${lexiconRes.status}, forms=${formsRes.status}, verses=${versesRes.status}`,
      );
      return;
    }

    const lexiconFile: LexiconFile = await lexiconRes.json();
    const verseLexemes: Record<string, LexemeId[]> = await versesRes.json();
    formToLexemes = await formsRes.json();
    verseToLexemes = verseLexemes;

    lexicon = [];
    printedSpellings = [];
    for (const [id, form, gloss, pos, language, printed] of lexiconFile.lexemes) {
      lexicon.push({ id, form, gloss, pos, language });
      printedSpellings.push(printed);
    }
    lexemeSpellings = lexicon.map((entry) => normalizeHebrewForSearch(entry.form));

    console.log(
      `✓ Loaded ${lexicon.length} lexemes (${lexiconFile.source}), ` +
        `${Object.keys(formToLexemes || {}).length} written forms, ` +
        `${Object.keys(verseLexemes).length} verses`,
    );

    lexemeToVerses = buildVerseIndex(verseLexemes);
    spellingToLexemes = buildSpellingIndex(lexemeSpellings);
  } catch (err) {
    console.error('Error loading the lexeme index; meanings search will find nothing:', err);
  }
}

/**
 * Invert verse -> lexemes into lexeme -> verses, so a meanings-mode search costs
 * one lookup per lexeme rather than a pass over all 23,000 verses.
 */
function buildVerseIndex(verseLexemes: Record<string, LexemeId[]>): Map<LexemeId, Set<string>> {
  const startTime = performance.now();
  const index = new Map<LexemeId, Set<string>>();

  for (const [verseKey, lexemes] of Object.entries(verseLexemes)) {
    for (const lexeme of lexemes) {
      let verses = index.get(lexeme);
      if (!verses) {
        verses = new Set();
        index.set(lexeme, verses);
      }
      verses.add(verseKey);
    }
  }

  const endTime = performance.now();
  console.log(
    `✓ Built verse index: ${index.size} lexemes in ${(endTime - startTime).toFixed(2)}ms`,
  );
  return index;
}

/**
 * Index lexemes by the consonants of their dictionary form, so that a reader
 * who types a bare root (בסס) finds it even though that spelling never stands
 * alone in the text.
 */
function buildSpellingIndex(spellings: string[]): Map<string, LexemeId[]> {
  const index = new Map<string, LexemeId[]>();
  for (let id = 0; id < spellings.length; id++) {
    const spelling = spellings[id];
    if (!spelling) continue;
    let list = index.get(spelling);
    if (!list) {
      list = [];
      index.set(spelling, list);
    }
    list.push(id);
  }
  console.log(`✓ Built spelling index: ${index.size} distinct dictionary spellings`);
  return index;
}

/**
 * Find the lexemes a written Hebrew word can be: the word exactly as printed,
 * then a bare dictionary spelling (the reader typed the dictionary form).
 *
 * Do not add prefix stripping or completion to a longer spelling. The index
 * files every printed word under its stem's lexeme, prefix and all, so בדבר
 * resolves without anything noticing the ב; and completion answered עליו "upon
 * him" with עֶלְיֹון "most high" on four shared letters.
 *
 * Null is an answer, not a failure: a word the dictionary does not know.
 */
export function findLexemesForWord(hebrewWord: string): LexemeId[] | null {
  if (!formToLexemes) return null;

  // word-lexemes keys fold final letters to their medial shape, so the query
  // has to be folded the same way. Trimmed because a separator folds to a
  // space: a word pasted with its sof pasuq would otherwise be looked up as
  // "הארצ " and miss, and no key carries an outer space.
  return lookupFormOrSpelling(normalizeHebrewForSearch(hebrewWord).trim());
}

/** The written form first, then the bare dictionary spelling. Both exact. */
function lookupFormOrSpelling(term: string): LexemeId[] | null {
  if (term.length === 0) return null;

  if (formToLexemes && formToLexemes[term]) {
    return formToLexemes[term];
  }

  const exact = spellingToLexemes?.get(term);
  if (exact && exact.length > 0) return exact;

  return null;
}

/** The spelling a lexeme is most often printed with; empty when it never is. */
export function printedSpelling(id: LexemeId): string {
  return printedSpellings[id] ?? '';
}

/**
 * How many verses a lexeme occurs in. O(1) against the inverted index, so it
 * is cheap enough to show beside every candidate meaning of a search term.
 */
export function getLexemeVerseCount(id: LexemeId): number {
  return lexemeToVerses?.get(id)?.size ?? 0;
}

/**
 * Look up a lexeme's dictionary record: display form, English gloss, part of
 * speech and language.
 */
export function getLexeme(id: LexemeId): Lexeme | null {
  return lexicon?.[id] ?? null;
}

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

    const chapterNums = Object.keys(chapters)
      .map(Number)
      .sort((a, b) => a - b);
    for (const chapter of chapterNums) {
      const verses = chapters[String(chapter)];
      const verseNums = Object.keys(verses)
        .map(Number)
        .sort((a, b) => a - b);

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
        verseKeyToEntry.set(tanakhKey(book, chapter, verse), entry);
      }
    }
  }
}

/**
 * The dictionary words a verse contains.
 *
 * Exposed for the dictionary seam, which uses it to decide which of a
 * spelling's readings is the one in front of the reader. Returns null when the
 * index has not loaded, which callers must treat as "cannot say" rather than
 * as "none".
 */
export function getVerseLexemes(verseKey: string): LexemeId[] | null {
  return verseToLexemes?.[verseKey] ?? null;
}

/**
 * Verse keys containing any of the given lexemes.
 * Uses the inverted index, so one lookup per lexeme rather than a full scan.
 */
export function searchByLexemes(lexemes: LexemeId[]): Set<string> {
  const matchingVerses = new Set<string>();
  for (const lexeme of lexemes) {
    for (const verseKey of lexemeToVerses?.get(lexeme) ?? []) {
      matchingVerses.add(verseKey);
    }
  }
  return matchingVerses;
}

/** A verse's text as the reader sees it, or null for a verse the index lacks. */
export function displayedVerse(
  verse: { book: string; chapter: number; verse: number },
  language: TextLanguage,
): string | null {
  const entry = verseKeyToEntry.get(tanakhKey(verse.book, verse.chapter, verse.verse));
  if (!entry) return null;
  return language === HEBREW ? entry.hebrewOriginal : entry.englishOriginal;
}

/** A verse quoted around a stretch of it, or its opening when there is nothing to mark. */
export function quoteVerse(
  text: string,
  range: { start: number; end: number } | null,
): { snippet: string; matchStart: number; matchEnd: number } {
  if (!range) {
    const limit = SEARCH_SNIPPET_MAX_LENGTH;
    return {
      snippet: text.length > limit ? `${text.slice(0, limit)}...` : text,
      matchStart: 0,
      matchEnd: 0,
    };
  }
  const snippet = createSnippetAtPosition(text, range.start, range.end - range.start);
  return { snippet: snippet.text, matchStart: snippet.matchStart, matchEnd: snippet.matchEnd };
}

/**
 * The verses a term's text matches, in the text of its own language.
 *
 * Meanings mode is not a `mode` here: it depends on which meanings the reader
 * has left checked, which the overlay knows and this does not.
 */
export function versesForTerm(text: string, language: TextLanguage, mode: MatchMode): Set<string> {
  const needle = foldForMatching(text, language);
  const verses = new Set<string>();
  for (const entry of searchIndex) {
    const haystack = language === HEBREW ? entry.hebrewText : entry.englishText;
    if (matchRangesInFolded(haystack, needle, { mode, language, limit: 1 }).length > 0) {
      verses.add(tanakhKey(entry.book, entry.chapter, entry.verse));
    }
  }
  return verses;
}

/**
 * Turn per-term sets of verse keys into search results.
 *
 * The sets arrive already decided. Resolving a term's text to lexemes belongs
 * with the reader's choice of which meanings the term stands for, which the
 * overlay holds and this does not.
 *
 * A term with no hits simply contributes nothing; term indices are positions
 * in the caller's list, so the gap keeps every other term's colour in place.
 */
export function resultsForVerseSets(termVerseKeys: Array<Set<string>>): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < termVerseKeys.length; termIndex++) {
    for (const verseKey of termVerseKeys[termIndex]) {
      const entry = verseKeyToEntry.get(verseKey);
      if (!entry) continue;

      let result = resultMap.get(verseKey);
      if (!result) {
        result = {
          book: entry.book,
          chapter: entry.chapter,
          verse: entry.verse,
          matchingTerms: [],
        };
        resultMap.set(verseKey, result);
      }
      if (!result.matchingTerms.some((m) => m.termIndex === termIndex)) {
        result.matchingTerms.push({ termIndex });
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

/** A snippet around a match whose position is already in the original text (no nikkud mapping). */
function createSnippetAtPosition(
  text: string,
  matchStart: number,
  matchLen: number,
): SnippetResult {
  const maxLen = SEARCH_SNIPPET_MAX_LENGTH;
  const contextBefore = SEARCH_SNIPPET_CONTEXT_BEFORE;

  const matchEnd = Math.min(matchStart + matchLen, text.length);

  let start = Math.max(0, matchStart - contextBefore);
  let end = Math.min(text.length, start + maxLen);

  if (end === text.length && end - start < maxLen) {
    start = Math.max(0, end - maxLen);
  }

  let snippet = text.slice(start, end);
  const adjustedMatchStart = matchStart - start;
  const adjustedMatchEnd = matchEnd - start;

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

export function getMatchingVerseTerms(results: SearchResult[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const r of results) {
    const key = tanakhKey(r.book, r.chapter, r.verse);
    map.set(
      key,
      r.matchingTerms.map((m) => m.termIndex),
    );
  }
  return map;
}
