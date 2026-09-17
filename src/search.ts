// Full-text search over Hebrew and English.
// Hebrew root search resolves written forms to ETCBC BHSA lexemes.

import type { VerseTexts } from './verseTexts';
import { getBookOrder } from './constants/books.ts';
import { tanakhKey } from './types.ts';

import {
  fetchData,
  MIN_SEARCH_TERM_LENGTH,
  TERM_SEPARATORS,
  SEARCH_SNIPPET_MAX_LENGTH,
  SEARCH_SNIPPET_CONTEXT_BEFORE,
} from './constants/app.ts';
import {
  countNikkudInRange,
  mapStrippedToOriginal,
  normalizeHebrewForSearch,
  splitIntoWords,
} from './hebrew.ts';

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
  hebrewText: string; // folded for matching: no points, finals and separators normalized
  hebrewOriginal: string; // original for display
  englishText: string; // lowercased
  englishOriginal: string; // original for display
}

const HEBREW_RANGE_START = 0x0590;
const HEBREW_RANGE_END = 0x05ff;

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

// Inverted index: lexeme -> the verses it occurs in. Turns a root-mode search
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
    .filter((t) => t.length >= MIN_SEARCH_TERM_LENGTH);
}

/** Row order of the lexeme records in lexicon.json */
type LexemeRow = [id: string, form: string, gloss: string, pos: string, language: 'heb' | 'arc'];

interface LexiconFile {
  source: string;
  fields: string[];
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
      console.warn('Failed to load lexeme index, falling back to whole-word search');
      console.warn(
        `Response status: lexicon=${lexiconRes.status}, forms=${formsRes.status}, verses=${versesRes.status}`,
      );
      return;
    }

    const lexiconFile: LexiconFile = await lexiconRes.json();
    formToLexemes = await formsRes.json();
    verseToLexemes = await versesRes.json();

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
        `${Object.keys(verseToLexemes || {}).length} verses`,
    );

    buildVerseIndex();
    buildSpellingIndex();
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
  console.log(
    `✓ Built verse index: ${lexemeToVerses.size} lexemes in ${(endTime - startTime).toFixed(2)}ms`,
  );
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
 * Find the lexemes a written Hebrew word can be: the word exactly as printed,
 * then a bare dictionary spelling (the reader typed the dictionary form).
 *
 * Do not add prefix stripping or completion to a longer spelling. The index
 * files every printed word under its stem's lexeme, prefix and all, so בדבר
 * resolves without anything noticing the ב; and completion answered עליו "upon
 * him" with עֶלְיֹון "most high" on four shared letters.
 *
 * Null is an answer, not a failure: the caller falls back to text matching and
 * marks the term unresolved. Exported so the overlay can tell which resolved.
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

/**
 * The vocalized Hebrew form of a lexeme, for showing which word was matched.
 */
export function getLexemeForm(id: LexemeId): string | null {
  return lexicon?.[id]?.form ?? null;
}

export function isHebrewQuery(query: string): boolean {
  for (const char of query) {
    const code = char.charCodeAt(0);
    if (code >= HEBREW_RANGE_START && code <= HEBREW_RANGE_END) {
      return true;
    }
  }
  return false;
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

        const verseKey = `${book}:${chapter}:${verse}`;
        verseKeyToEntry.set(verseKey, entry);
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
    if (lexemes.some((lexeme) => verseLexemes.includes(lexeme))) {
      matchingVerses.add(verseKey);
    }
  }
  return matchingVerses;
}

/** Where the word at `wordIndex` starts and ends, or null past the last one. */
export function getWordBoundaries(
  text: string,
  wordIndex: number,
): { start: number; end: number } | null {
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

export function searchHebrewWholeWord(terms: string[]): SearchResult[] {
  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = normalizeHebrewForSearch(term);

    for (const entry of searchIndex) {
      const words = indexedWords(entry);
      const wordIndex = words.findIndex((word) => word === normalizedTerm);

      if (wordIndex !== -1) {
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

          if (!result.matchingTerms.some((m) => m.termIndex === termIndex)) {
            const wordLen = wordBounds.end - wordBounds.start;
            const snippet = createSnippetAtPosition(
              entry.hebrewOriginal,
              wordBounds.start,
              wordLen,
            );
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

/** The opening of a verse, for when there is nothing to mark in it. */
function truncateForSnippet(text: string): string {
  const limit = 60;
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

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wholeWord = new RegExp(`\\b${escaped}\\b`).exec(text);
  if (wholeWord) return { idx: wholeWord.index, len: wholeWord[0].length };

  const idx = text.indexOf(term);
  return idx === -1 ? null : { idx, len: term.length };
}

/** Snippet/highlight data for one match, computed lazily — only when the result is shown. */
export function computeSnippetForMatch(
  result: SearchResult,
  _termIndex: number,
  searchTerm: string,
): { snippet: string; matchStart: number; matchEnd: number } | null {
  const verseKey = `${result.book}:${result.chapter}:${result.verse}`;
  const entry = verseKeyToEntry.get(verseKey);
  if (!entry) return null;

  // An English term reads the English verse. Everything below it works on the
  // Hebrew, which is all this function used to do, and every English result
  // came through it quoting a Hebrew verse the reader had not searched.
  if (!isHebrewQuery(searchTerm)) {
    const match = findEnglishMatch(entry.englishText, searchTerm.toLowerCase());
    if (match) {
      const snippet = createSnippet(entry.englishOriginal, match.idx, match.len, false);
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
    // Positions cannot be taken from the index: BHSA splits prefixes into
    // separate words, so its word numbering does not line up with the
    // whitespace tokens of the displayed text.
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

  // The term resolved to no lexeme. Fall back to the spelling as typed.
  const spelled = indexedWords(entry).indexOf(normalizeHebrewForSearch(searchTerm));
  if (spelled >= 0) {
    const found = snippetAtWord(entry, spelled);
    if (found) return found;
  }

  // Nothing to point at: show the opening of the verse unmarked.
  return {
    snippet: truncateForSnippet(entry.hebrewOriginal),
    matchStart: 0,
    matchEnd: 0,
  };
}

/**
 * The verses each term matches, decided term by term.
 *
 * The language of a search used to be read off its first term, so a Hebrew
 * word beside an English one meant the English one was hunted for in the
 * Hebrew text and found nothing. A term's own text decides now, and the two
 * settings that are language-specific — whole-word for English, the matching
 * mode for Hebrew — apply only to the terms they can apply to.
 *
 * Root mode is not handled here: it depends on which meanings the reader has
 * left checked, which the overlay knows and this does not.
 */
export function verseSetsForTerms(
  termTexts: string[],
  options: { wholeWordEnglish?: boolean; hebrewMode?: 'substring' | 'word' } = {},
): Array<Set<string>> {
  return termTexts.map((text) => {
    const isHebrew = isHebrewQuery(text);
    const results = search(
      text,
      isHebrew ? false : options.wholeWordEnglish === true,
      isHebrew ? (options.hebrewMode ?? 'substring') : 'substring',
    );
    return new Set(results.map((r) => tanakhKey(r.book, r.chapter, r.verse)));
  });
}

/**
 * Turn per-term sets of verse keys into search results.
 *
 * Root mode used to resolve a term's text to lexemes and union their verses
 * inside search(). Once the reader can choose which of a word's meanings the
 * term stands for, that resolution belongs where the choice lives, so the sets
 * arrive already decided. Snippets are left for computeSnippetForMatch, as
 * root mode has always done.
 *
 * A term with no hits simply contributes nothing; term indices are positions
 * in the caller's list, so the gap keeps every other term's colour in place.
 */
export function resultsForVerseSets(
  termVerseKeys: Array<Set<string>>,
  termLanguages?: Array<'he' | 'en'>,
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
          language: termLanguages?.[termIndex] ?? 'he',
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

/**
 * Verses matching any of the comma-separated terms.
 *
 * Hebrew: substring (nikkud-insensitive, the default) or whole-word. Root mode
 * is not a `hebrewMode` value here — it resolves a term to dictionary meanings
 * and looks up their verses directly, in the search overlay.
 * English: substring, optionally whole-word via `wholeWord`.
 */
export function search(
  query: string,
  wholeWord: boolean = false,
  hebrewMode: 'substring' | 'word' = 'substring',
): SearchResult[] {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // The first term picks the path for the whole query. A query that mixes
  // scripts searches whichever text its first term points at, so the other
  // terms simply find nothing.
  const isHebrew = isHebrewQuery(terms[0]);

  if (isHebrew) {
    switch (hebrewMode) {
      case 'word':
        return searchHebrewWholeWord(terms);
      case 'substring':
      default:
        break;
    }
  }

  const resultMap = new Map<string, SearchResult>();

  for (let termIndex = 0; termIndex < terms.length; termIndex++) {
    const term = terms[termIndex];
    const normalizedTerm = isHebrew ? normalizeHebrewForSearch(term) : term.toLowerCase();

    for (const entry of searchIndex) {
      const text = isHebrew ? entry.hebrewText : entry.englishText;
      const original = isHebrew ? entry.hebrewOriginal : entry.englishOriginal;

      let matches: Array<{ idx: number; len: number }> = [];

      if (!isHebrew && wholeWord) {
        const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTerm}\\b`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({ idx: match.index, len: match[0].length });
        }
      } else {
        const idx = text.indexOf(normalizedTerm);
        if (idx !== -1) {
          matches.push({ idx, len: normalizedTerm.length });
        }
      }

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

        if (!result.matchingTerms.some((m) => m.termIndex === termIndex)) {
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

/**
 * A snippet around a match whose position is given in nikkud-stripped text.
 * The positions move because the points sit between the letters.
 */
function createSnippet(
  text: string,
  matchIdx: number,
  matchLen: number,
  isHebrew: boolean = false,
): SnippetResult {
  if (!isHebrew) return createSnippetAtPosition(text, matchIdx, matchLen);

  const origStart = mapStrippedToOriginal(text, matchIdx);
  const nikkudInMatch = countNikkudInRange(text, origStart, matchLen);
  return createSnippetAtPosition(text, origStart, matchLen + nikkudInMatch);
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
