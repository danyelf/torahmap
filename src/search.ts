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
import {
  isHebrew,
  isSearchableWord,
  mapStrippedToOriginal,
  normalizeHebrewForSearch,
  splitIntoWords,
} from './hebrew.ts';
import {
  escapeForRegex,
  foldForMatching,
  matchRangesInFolded,
  type MatchMode,
} from './search/matching.ts';
import type { TextLanguage } from './types.ts';

export interface TermMatch {
  termIndex: number;
}

export interface SearchResult {
  book: string;
  chapter: number;
  verse: number;
  language: TextLanguage;
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

/** The terms a query string names, dropping ones too short to search on. */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(TERM_SEPARATORS)
    .map((t) => t.trim())
    .filter(isSearchableWord);
}

/** A lexeme as lexicon.json writes it, in the order generate-lexeme-index.py writes. */
type LexemeRow = [id: string, form: string, gloss: string, pos: string, language: LexemeLanguage];

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

    lexicon = lexiconFile.lexemes.map(([id, form, gloss, pos, language]) => ({
      id,
      form,
      gloss,
      pos,
      language,
    }));
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

// Lexeme -> the written forms filed under it, built on first use.
let lexemeToForms: Map<LexemeId, string[]> | null = null;

/** The written forms that can be this lexeme. */
export function formsOfLexeme(id: LexemeId): string[] {
  if (!lexemeToForms && formToLexemes) {
    lexemeToForms = new Map();
    for (const [form, ids] of Object.entries(formToLexemes)) {
      for (const lexeme of ids) {
        const forms = lexemeToForms.get(lexeme);
        if (forms) forms.push(form);
        else lexemeToForms.set(lexeme, [form]);
      }
    }
  }
  return lexemeToForms?.get(id) ?? [];
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

/** Where the word at `wordIndex` starts and ends, or null past the last one. */
function getWordBoundaries(text: string, wordIndex: number): { start: number; end: number } | null {
  if (wordIndex < 0) return null;
  const word = splitIntoWords(text)[wordIndex];
  return word ? { start: word.start, end: word.end } : null;
}

/** The words of an indexed verse, in the same order `getWordBoundaries` walks. */
function indexedWords(entry: IndexEntry): string[] {
  return splitIntoWords(entry.hebrewText).map((w) => w.word);
}

/** A snippet around the nth word of a verse, as it is written with its points. */
function snippetAtWord(
  entry: IndexEntry,
  wordIndex: number,
): { snippet: string; matchStart: number; matchEnd: number } | null {
  const bounds = getWordBoundaries(entry.hebrewOriginal, wordIndex);
  if (!bounds) return null;

  const snippet = createSnippetAtPosition(
    entry.hebrewOriginal,
    bounds.start,
    bounds.end - bounds.start,
  );
  return { snippet: snippet.text, matchStart: snippet.matchStart, matchEnd: snippet.matchEnd };
}

/** The opening of a verse, for when there is nothing to mark in it. */
function truncateForSnippet(text: string): string {
  const limit = SEARCH_SNIPPET_MAX_LENGTH;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

/**
 * Where an English term sits in a verse. Both strings are already lowercased.
 *
 * A whole word wins over a substring, so searching "covenant" marks the word
 * itself rather than the opening of an earlier "covenanted". Which of the two
 * the reader asked for is not known here, and preferring the word is right
 * either way: under whole-word matching it is the only legitimate hit, and
 * under substring matching it is the one they meant.
 */
function findEnglishMatch(text: string, term: string): { idx: number; len: number } | null {
  if (term.length === 0) return null;

  const wholeWord = new RegExp(`\\b${escapeForRegex(term)}\\b`).exec(text);
  if (wholeWord) return { idx: wholeWord.index, len: wholeWord[0].length };

  const idx = text.indexOf(term);
  return idx === -1 ? null : { idx, len: term.length };
}

/** Snippet/highlight data for one match, computed lazily — only when the result is shown. */
export function computeSnippetForMatch(
  result: SearchResult,
  searchTerm: string,
): { snippet: string; matchStart: number; matchEnd: number } | null {
  const entry = verseKeyToEntry.get(tanakhKey(result.book, result.chapter, result.verse));
  if (!entry) return null;

  // An English term reads the English verse; everything below this works on the
  // Hebrew. Falling through to it hands an English result a snippet of a Hebrew
  // verse the reader never searched.
  if (!isHebrew(searchTerm)) {
    const match = findEnglishMatch(entry.englishText, searchTerm.toLowerCase());
    if (match) {
      const snippet = createSnippetAtPosition(entry.englishOriginal, match.idx, match.len);
      return {
        snippet: snippet.text,
        matchStart: snippet.matchStart,
        matchEnd: snippet.matchEnd,
      };
    }

    return {
      snippet: truncateForSnippet(entry.englishOriginal),
      matchStart: 0,
      matchEnd: 0,
    };
  }

  const lexemes = findLexemesForWord(searchTerm);
  if (lexemes && lexemes.length > 0) {
    // Find the word in the verse that resolves to one of the same lexemes.
    //
    // By spelling, not by position. The parse numbers the printed words, and
    // the marking inside a verse reads the answer straight off it, but it is
    // worked out only for the verse on screen — and a result row is some other
    // verse.
    const wanted = new Set(lexemes);
    const words = indexedWords(entry);
    const normalizedSearch = normalizeHebrewForSearch(searchTerm);

    // Prefer the word the reader actually typed. A verse can hold several
    // words that share a reading with the term, and highlighting the one
    // spelled the same is the least surprising choice.
    let wordIndex = words.indexOf(normalizedSearch);

    if (wordIndex < 0) {
      wordIndex = words.findIndex((word) => {
        const wordLexemes = findLexemesForWord(word);
        return wordLexemes !== null && wordLexemes.some((id) => wanted.has(id));
      });
    }

    if (wordIndex < 0) {
      wordIndex = words.findIndex((w) => w.includes(normalizedSearch));
    }

    if (wordIndex >= 0) {
      const found = snippetAtWord(entry, wordIndex);
      if (found) return found;
    }
  }

  // The term resolved to no lexeme. Fall back to the spelling as typed, a
  // word or a phrase, as the search found it.
  const [spelled] = matchRangesInFolded(
    entry.hebrewText,
    normalizeHebrewForSearch(searchTerm).trim(),
    { mode: 'word', language: HEBREW, limit: 1 },
  );
  if (spelled) {
    const start = mapStrippedToOriginal(entry.hebrewOriginal, spelled.start);
    const end = mapStrippedToOriginal(entry.hebrewOriginal, spelled.end);
    const snippet = createSnippetAtPosition(entry.hebrewOriginal, start, end - start);
    return { snippet: snippet.text, matchStart: snippet.matchStart, matchEnd: snippet.matchEnd };
  }

  // Nothing to point at: show the opening of the verse unmarked.
  return {
    snippet: truncateForSnippet(entry.hebrewOriginal),
    matchStart: 0,
    matchEnd: 0,
  };
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
 * overlay holds and this does not. Snippets are left to computeSnippetForMatch.
 *
 * A term with no hits simply contributes nothing; term indices are positions
 * in the caller's list, so the gap keeps every other term's colour in place.
 */
export function resultsForVerseSets(
  termVerseKeys: Array<Set<string>>,
  termLanguages?: TextLanguage[],
): SearchResult[] {
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
          // The first term to claim a verse decides which text its snippet is
          // drawn from, so an English term shows English.
          language: termLanguages?.[termIndex] ?? HEBREW,
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
