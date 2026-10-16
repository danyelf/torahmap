// The Tanakh's verses as search reads them, and the dictionary behind meanings mode.
// Meanings mode resolves a written form to the ETCBC BHSA lexemes it can be.

import { memoByValue } from '@torahmap/utils';
import type { VerseTexts } from '../verseTexts';
import { verseId, verseRef } from '@torahmap/link/tanakh';
import { buildTextIndex as indexOf, type SearchEntry, type TextIndex } from '@torahmap/search';
import { normalizeHebrewForSearch } from '@torahmap/hebrew';
import { TANAKH_LANGUAGES } from './languages.ts';

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

/** The books in order, as the structure file lists them. */
export interface BookOrder {
  readonly books: readonly { readonly name: string }[];
}

// Per structure, then per texts.
const textIndexes = memoByValue((structure: BookOrder) =>
  memoByValue((texts: VerseTexts) =>
    textIndexFrom(
      texts,
      structure.books.map((book) => book.name),
    ),
  ),
);

/** The verses folded for matching, in the structure's book order. The same files give the same object. */
export function buildTextIndex(texts: VerseTexts, structure: BookOrder): TextIndex {
  return textIndexes(structure)(texts);
}

function textIndexFrom(verseTexts: VerseTexts, books: readonly string[]): TextIndex {
  const entries: SearchEntry[] = [];
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
        entries.push({
          id: verseId(book, chapter, verse),
          ref: verseRef({ book, chapter, verse }),
          text: { he, en },
        });
      }
    }
  }
  return indexOf(entries, TANAKH_LANGUAGES);
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
