// Full-text search over Hebrew and English.
// Meanings mode resolves a written form to the ETCBC BHSA lexemes it can be.

import type { VerseTexts } from './verseTexts';
import { memoByValue } from './utils/memo.ts';
import { getBookOrder } from './constants/books.ts';
import { HEBREW, tanakhKey } from './types.ts';

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

/** Every verse folded for matching, in book order, and each by its key. */
export interface TextIndex {
  entries: IndexEntry[];
  byKey: Map<string, IndexEntry>;
}

/** Written form (nikkud stripped, finals folded) -> the lexemes it can be, likeliest reading first. */
export type FormsFile = Record<string, LexemeId[]>;

/** Verse key -> the lexemes occurring in that verse. */
export type VerseLexemesFile = Record<string, LexemeId[]>;

/** The three lexeme files, and what is worked out from them. */
export interface Dictionary {
  /** Parallel to lexicon.json's rows: a LexemeId is a position here. */
  lexemes: Lexeme[];
  /** Each lexeme's commonest spelling, as printed. Parallel to `lexemes`. */
  printedSpellings: string[];
  formToLexemes: FormsFile;
  verseToLexemes: VerseLexemesFile;
  /** Lexeme -> the verses it occurs in: a meanings search is one lookup per lexeme. */
  lexemeToVerses: Map<LexemeId, Set<string>>;
  /** Consonantal dictionary spelling -> lexemes, for a reader who types a bare root. */
  spellingToLexemes: Map<string, LexemeId[]>;
  /** A lexeme's key (lexemeKey) -> the lexeme. */
  keyToLexeme: Map<string, LexemeId>;
}

/**
 * How a lexeme is named outside the dictionary: ETCBC's identifier and its
 * language. See search/dictionary.ts for why the language is part of it.
 */
export function lexemeKey(lexeme: Lexeme): string {
  return `${lexeme.id}@${lexeme.language}`;
}

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

export interface LexiconFile {
  source: string;
  lexemes: LexemeRow[];
}

/** The three lexeme files the dictionary is built from. */
export interface DictionaryFiles {
  lexicon: LexiconFile;
  forms: FormsFile;
  verseLexemes: VerseLexemesFile;
}

// Per file value, not per object holding them: each arrival of a file hands
// search a new object holding the same three files.
const dictionaries = memoByValue((lexicon: LexiconFile) =>
  memoByValue((forms: FormsFile) =>
    memoByValue((verseLexemes: VerseLexemesFile) => dictionaryFrom(lexicon, forms, verseLexemes)),
  ),
);

/** The dictionary these files describe. The same files give the same object. */
export function buildDictionary({ lexicon, forms, verseLexemes }: DictionaryFiles): Dictionary {
  return dictionaries(lexicon)(forms)(verseLexemes);
}

function dictionaryFrom(
  lexicon: LexiconFile,
  forms: FormsFile,
  verseLexemes: VerseLexemesFile,
): Dictionary {
  const lexemes: Lexeme[] = [];
  const printedSpellings: string[] = [];
  for (const [id, form, gloss, pos, language, printed] of lexicon.lexemes) {
    lexemes.push({ id, form, gloss, pos, language });
    printedSpellings.push(printed);
  }
  return {
    lexemes,
    printedSpellings,
    formToLexemes: forms,
    verseToLexemes: verseLexemes,
    lexemeToVerses: buildVerseIndex(verseLexemes),
    spellingToLexemes: buildSpellingIndex(lexemes.map((l) => normalizeHebrewForSearch(l.form))),
    keyToLexeme: new Map(lexemes.map((lexeme, id) => [lexemeKey(lexeme), id])),
  };
}

/**
 * Invert verse -> lexemes into lexeme -> verses, so a meanings-mode search costs
 * one lookup per lexeme rather than a pass over all 23,000 verses.
 */
function buildVerseIndex(verseLexemes: Record<string, LexemeId[]>): Map<LexemeId, Set<string>> {
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
export function findLexemesForWord(dictionary: Dictionary, hebrewWord: string): LexemeId[] | null {
  // word-lexemes keys fold final letters to their medial shape, so the query
  // has to be folded the same way. Trimmed because a separator folds to a
  // space: a word pasted with its sof pasuq would otherwise be looked up as
  // "הארצ " and miss, and no key carries an outer space.
  return lookupFormOrSpelling(dictionary, normalizeHebrewForSearch(hebrewWord).trim());
}

/** The written form first, then the bare dictionary spelling. Both exact. */
function lookupFormOrSpelling(dictionary: Dictionary, term: string): LexemeId[] | null {
  if (term.length === 0) return null;

  if (dictionary.formToLexemes[term]) {
    return dictionary.formToLexemes[term];
  }

  const exact = dictionary.spellingToLexemes.get(term);
  if (exact && exact.length > 0) return exact;

  return null;
}

/** The spelling a lexeme is most often printed with; empty when it never is. */
export function printedSpelling(dictionary: Dictionary, id: LexemeId): string {
  return dictionary.printedSpellings[id] ?? '';
}

/**
 * Look up a lexeme's dictionary record: display form, English gloss, part of
 * speech and language.
 */
export function getLexeme(dictionary: Dictionary, id: LexemeId): Lexeme | null {
  return dictionary.lexemes[id] ?? null;
}

/** The verses folded for matching, in book order. The same texts give the same object. */
export const buildTextIndex: (texts: VerseTexts) => TextIndex = memoByValue(textIndexFrom);

function textIndexFrom(verseTexts: VerseTexts): TextIndex {
  const entries: IndexEntry[] = [];
  const byKey = new Map<string, IndexEntry>();

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
        entries.push(entry);
        byKey.set(tanakhKey(book, chapter, verse), entry);
      }
    }
  }
  return { entries, byKey };
}

/**
 * The dictionary words a verse contains.
 *
 * Exposed for the dictionary seam, which uses it to decide which of a
 * spelling's readings is the one in front of the reader. Null when the
 * dictionary has no entry for the verse, which callers treat as "cannot say"
 * rather than as "none".
 */
export function getVerseLexemes(dictionary: Dictionary, verseKey: string): LexemeId[] | null {
  return dictionary.verseToLexemes[verseKey] ?? null;
}

/**
 * Verse keys containing any of the given lexemes.
 * Uses the inverted index, so one lookup per lexeme rather than a full scan.
 */
export function searchByLexemes(dictionary: Dictionary, lexemes: LexemeId[]): Set<string> {
  const matchingVerses = new Set<string>();
  for (const lexeme of lexemes) {
    for (const verseKey of dictionary.lexemeToVerses.get(lexeme) ?? []) {
      matchingVerses.add(verseKey);
    }
  }
  return matchingVerses;
}

/** A verse's text as the reader sees it, or null for a verse the index lacks. */
export function displayedVerse(
  index: TextIndex,
  verse: { book: string; chapter: number; verse: number },
  language: TextLanguage,
): string | null {
  const entry = index.byKey.get(tanakhKey(verse.book, verse.chapter, verse.verse));
  if (!entry) return null;
  return language === HEBREW ? entry.hebrewOriginal : entry.englishOriginal;
}

/** The text around a match, and where the match sits in it. */
export interface Snippet {
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

/** A verse quoted around a stretch of it, or its opening when there is nothing to mark. */
export function quoteVerse(text: string, range: { start: number; end: number } | null): Snippet {
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
export function versesForTerm(
  index: TextIndex,
  text: string,
  language: TextLanguage,
  mode: MatchMode,
): Set<string> {
  const needle = foldForMatching(text, language);
  const verses = new Set<string>();
  for (const entry of index.entries) {
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
export function resultsForVerseSets(
  index: TextIndex,
  termVerseKeys: Array<Set<string>>,
): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < termVerseKeys.length; termIndex++) {
    for (const verseKey of termVerseKeys[termIndex]) {
      const entry = index.byKey.get(verseKey);
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
