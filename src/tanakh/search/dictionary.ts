// The dictionary seam.
//
// Search asks this module two questions: what could a written form be, and
// which verses carry a given set of meanings. ETCBC answers them today; the
// interface is deliberately narrow so another dictionary could.
//
// The seam exists for a specific reason. A `LexemeId` is a position in the
// dictionary array loaded at startup, so every value shifts if the index is
// regenerated. It is a fine in-memory handle and a terrible thing to write into
// a URL. Outside this module a meaning is identified by its `key`, which is
// ETCBC's own identifier paired with its language — `<LH/@heb`. The language is
// not decoration: 461 ETCBC ids are shared by a Hebrew word and an Aramaic one,
// and `<LH/` is both burnt-offering and pretext.

import {
  findLexemesForWord,
  printedSpelling,
  getLexeme,
  getVerseLexemes,
  lexemeKey,
  searchByLexemes,
  type Dictionary,
  type Lexeme,
  type LexemeId,
} from './search.ts';
import {
  KETIV,
  QERE,
  isHebrew,
  onlySeparators,
  mapStrippedToOriginal,
  splitIntoWords,
  stripNikkud,
  type TextWord,
} from '../../hebrew.ts';
import { isSectionMarker, verseWords } from '../../verseWords.ts';
import { memoByValue, memoByValueAndKey } from '../../utils/memo.ts';

/**
 * One dictionary word a written form might be, as a reader sees it.
 *
 * Usually one ETCBC lexeme, hence usually one key. Sometimes more: ETCBC gives
 * separate entries to different people bearing the same name, so 71 written
 * forms offer candidates identical in spelling, gloss, part of speech and
 * language. Two identical checkboxes are worse than one, so those become a
 * single row covering every lexeme behind it.
 */
export interface Meaning extends Omit<Lexeme, 'id'> {
  /** Stable across regeneration of the index: ETCBC id and language. */
  keys: string[];
  /** Verses this word occurs in, across every spelling of it. */
  verseCount: number;
}

/** What makes two candidates indistinguishable on screen. */
function renderedAs(m: { form: string; gloss: string; pos: string; language: string }): string {
  return `${m.form}\u0000${m.gloss}\u0000${m.pos}\u0000${m.language}`;
}

function keyOf(dictionary: Dictionary, id: LexemeId): string | null {
  const lexeme = getLexeme(dictionary, id);
  return lexeme ? lexemeKey(lexeme) : null;
}

/** How many verses a lexeme occurs in: one lookup, cheap enough beside every candidate meaning. */
function verseCountOf(dictionary: Dictionary, id: LexemeId): number {
  return dictionary.lexemeToVerses.get(id)?.size ?? 0;
}

/**
 * Merge a list of lexeme ids into the rows a reader sees, so that both
 * questions about a word share one answer shape.
 */
function rowsFor(dictionary: Dictionary, ids: LexemeId[]): Meaning[] {
  // Merge as we go, so a merged row keeps the position of its likeliest member
  // and the order stays the order the data gave us.
  const rows = new Map<string, { meaning: Meaning; group: LexemeId[] }>();

  for (const id of ids) {
    const lexeme = getLexeme(dictionary, id);
    const key = keyOf(dictionary, id);
    if (!lexeme || key === null) continue;

    const rendered = renderedAs(lexeme);
    const row = rows.get(rendered);
    if (row) {
      row.meaning.keys.push(key);
      row.group.push(id);
      continue;
    }

    rows.set(rendered, {
      meaning: {
        keys: [key],
        form: lexeme.form,
        gloss: lexeme.gloss,
        pos: lexeme.pos,
        language: lexeme.language,
        // A merged row's verses are the union of its members', not the sum:
        // the two Shechems share two verses, so adding would report 56 where
        // there are 54. Filled in below, once the group is complete.
        verseCount: 0,
      },
      group: [id],
    });
  }

  // Drops six rows a reader could only read past: the Hebrew ו, ה, ש and the
  // Aramaic כ, ו, ה, proclitics the word rule leaves in no verse.
  return [...rows.values()]
    .map(({ meaning, group }) => ({
      ...meaning,
      verseCount:
        group.length === 1
          ? verseCountOf(dictionary, group[0])
          : searchByLexemes(dictionary, group).size,
    }))
    .filter((meaning) => meaning.verseCount > 0);
}

/**
 * Is this row the reading these keys name?
 *
 * A row is not identified by its first key. It stands for every lexeme merged
 * into it, and `rowsFor` keeps whichever of them came first in the list it was
 * handed - so the same reading comes back from `meaningsFor` and
 * `meaningsInVerse` under two different first keys whenever the verse does not
 * contain the group's earliest member. Anything that compares first keys
 * across those two lists will miss, and a reader who picks a reading from one
 * list gets a search built from the other. Sharing a single lexeme is what
 * makes two rows the same reading.
 */
export function sameMeaning(meaning: Meaning, keys: readonly string[]): boolean {
  return meaning.keys.some((key) => keys.includes(key));
}

/**
 * The dictionary words a written form could be, likeliest reading first.
 *
 * "Likeliest" means how often that spelling is read as that word, which is not
 * the same as `verseCount` — that counts the word across all of its spellings.
 * The two disagree for about a third of ambiguous forms, so a list ordered one
 * way and labelled the other can look mis-sorted. It is not.
 *
 * Kept per dictionary and form, so a panel drawing a term's rows is handed the
 * same objects every time. Callers must not change them.
 */
export const meaningsFor: (dictionary: Dictionary, writtenForm: string) => Meaning[] =
  memoByValueAndKey((dictionary: Dictionary, writtenForm: string) => {
    const ids = findLexemesForWord(dictionary, writtenForm);
    return ids ? rowsFor(dictionary, ids) : [];
  });

/**
 * Which dictionary word is this written form, in this verse?
 *
 * Given `wordIndex` — which of the verse's printed words it is, counting from
 * zero the way `verseWords` does — this is a lookup rather than a guess, and
 * answers with the words BHSA parsed there: one, or two for a ketiv read as
 * two (בגד, read בָּא גָד) or a word the page prints solid (הללויה). It needs
 * the verse's words (wordsOfVerse).
 *
 * Without that, the verse narrows the spelling instead of settling it. Hebrew
 * does not write most vowels, so half the words in the text could be several
 * dictionary words; the reading in front of the reader is one the verse
 * contains and the spelling's other candidates usually are not. It can leave
 * two readings standing — see `word-in-verse.test.ts`, לו in Genesis 2:18.
 *
 * An empty result means "cannot say": a spelling the dictionary does not carry
 * at a place the parse has no word for. Callers offer a literal search rather
 * than treating it as an error.
 */
export function meaningsInVerse(
  dictionary: Dictionary,
  words: VerseWords | null,
  writtenForm: string,
  verseKey: string,
  wordIndex?: number,
): Meaning[] {
  const parsed = wordIndex === undefined ? null : namedWord(words, verseKey, wordIndex);
  if (parsed !== null) return parsed.flatMap((id) => rowForLexeme(dictionary, id, writtenForm));

  const ids = findLexemesForWord(dictionary, writtenForm);
  if (!ids) return [];

  const inVerse = getVerseLexemes(dictionary, verseKey);
  if (!inVerse) return [];

  const present = new Set(inVerse);
  return rowsFor(
    dictionary,
    ids.filter((id) => present.has(id)),
  );
}

/**
 * The one row for a lexeme the parse named.
 *
 * Built from the spelling's own candidate list where it holds the lexeme, so
 * that the row a reader picks here is identical — keys and all — to the row
 * `meaningsFor` would have offered them. Compound names are the exception:
 * בֵּית אֵל is filed under Bethel while its halves are spellings of "house" and
 * "god", so the lexeme stands alone and gets a row of its own.
 */
function rowForLexeme(dictionary: Dictionary, id: LexemeId, writtenForm: string): Meaning[] {
  const key = keyOf(dictionary, id);
  const row =
    key === null
      ? undefined
      : meaningsFor(dictionary, writtenForm).find((m) => m.keys.includes(key));
  return row ? [row] : rowsFor(dictionary, [id]);
}

/**
 * A spelling to search a chosen meaning under.
 *
 * A term offers the meanings of its text, so a meaning its text cannot be is
 * lost the moment the term is built: a click on (בגד), read בָּא גָד, can choose
 * "fortune", which is no reading of בגד. So the clicked spelling when it has
 * the meaning, then the meaning's dictionary spelling, then the spelling it
 * is most often printed with, or null when it is never printed.
 */
export function spellingFor(
  dictionary: Dictionary,
  keys: readonly string[],
  clicked: string,
): string | null {
  const has = (text: string) => formMatches(dictionary, keys, text);
  if (has(clicked)) return clicked;

  const ids = [...lexemesForKeys(dictionary, keys)];
  for (const id of ids) {
    const spelling = stripNikkud(getLexeme(dictionary, id)?.form ?? '');
    if (spelling && has(spelling)) return spelling;
  }
  return ids.map((id) => printedSpelling(dictionary, id)).find(Boolean) ?? null;
}

/** The verses carrying any of these meanings. */
export function versesFor(dictionary: Dictionary, keys: string[]): Set<string> {
  return searchByLexemes(dictionary, [...lexemesForKeys(dictionary, keys)]);
}

/**
 * Is this written word one of the given meanings?
 *
 * Used to decide which words to highlight inside a verse. It has to respect the
 * reader's choice: once a term is narrowed to burnt-offering, a verb meaning
 * "ascend" in the same verse is not a hit and must not be marked as one.
 *
 * Kept here rather than in the caller so that `LexemeId` stays behind the seam.
 */
export function formMatches(
  dictionary: Dictionary,
  keys: readonly string[],
  writtenForm: string,
): boolean {
  const ids = findLexemesForWord(dictionary, writtenForm);
  if (!ids || ids.length === 0) return false;

  const wanted = lexemesForKeys(dictionary, keys);
  return ids.some((id) => wanted.has(id));
}

function lexemesForKeys(dictionary: Dictionary, keys: readonly string[]): Set<LexemeId> {
  const wanted = new Set<LexemeId>();
  for (const key of keys) {
    const id = dictionary.keyToLexeme.get(key);
    if (id !== undefined) wanted.add(id);
  }
  return wanted;
}

// ---------------------------------------------------------------------------
// The word in front of the reader
//
// Everything above answers about a spelling. BHSA parsed each occurrence
// individually, and `verse-morphology.json` keeps that: every morpheme of a
// verse in text order, and how many of them each printed word is made of. The
// last morpheme of a printed word is its stem, and the stem's lexeme is the
// dictionary word the reader is looking at: no inference involved.
//
// It costs 4.5 MB, more than the other three files together, so search works
// without it: it is an optional file, and until it is in every answer here is
// the one the spelling gives.

/** morphemes as [lexeme, parsing], morphemes per printed word, maqaf positions. */
type ParsedVerse = [Array<[LexemeId, number]>, number[], number[]];

/** The per-word parse: verse-morphology.json. */
export interface Parse {
  /** For the verses the page divides into words differently: each shown word's lexemes. */
  realigned: Record<string, LexemeId[][]>;
  verses: Record<string, ParsedVerse>;
}

/**
 * A verse's Hebrew, its clickable words, and the dictionary words of its
 * printed words by where each starts in the text.
 */
export interface VerseWords {
  verseKey: string;
  hebrew: string;
  clickable: TextWord[];
  named: Map<number, LexemeId[]>;
}

const linedUpByParse = memoByValue(
  (_parse: Parse) => new Map<string, { hebrew: string; words: VerseWords | null }>(),
);

/**
 * The dictionary words of each printed word of this verse, or null when the
 * parse is not in or its words do not line up with this text. Kept per parse
 * and verse.
 */
export function wordsOfVerse(
  parse: Parse | null,
  verseKey: string,
  hebrew: string,
): VerseWords | null {
  if (!parse) return null;
  const kept = linedUpByParse(parse);
  const known = kept.get(verseKey);
  if (known?.hebrew === hebrew) return known.words;
  const clickable = verseWords(hebrew);
  const named = namedWords(parse, verseKey, hebrew, clickable);
  const words = named && { verseKey, hebrew, clickable, named };
  kept.set(verseKey, { hebrew, words });
  return words;
}

/** Does a click on this word of the verse land on a word BHSA parsed? */
export function wordIsNamed(words: VerseWords | null, wordIndex: number): boolean {
  return words !== null && namedWord(words, words.verseKey, wordIndex) !== null;
}

/**
 * The printed words BHSA has a word for, where each starts in the verse text:
 * not the section markers, and not the ketiv, which is blanked so offsets keep
 * their meaning. Same rule as `displayed_words()` in
 * scripts/search/generate-lexeme-index.py, which the file was aligned against.
 */
export function wordsBhsaParsed(hebrew: string): TextWord[] {
  const blanked = hebrew.replace(KETIV, (m) => ' '.repeat(m.length));
  return splitIntoWords(blanked).filter(({ word }) => !isSectionMarker(word) && isHebrew(word));
}

/**
 * Where each printed word of a verse starts, and which dictionary word it is.
 *
 * Where the page divides a verse into words as BHSA does, a word is the one
 * at its position; where it does not, the file says which words each shown
 * word is, lined up by letter. Null rather than a partial answer when the count
 * disagrees anyway, because a position one word out labels every word after it
 * with its neighbour's dictionary entry — wrong, and plausible enough to go
 * unnoticed.
 */
function namedWords(
  parse: Parse,
  verseKey: string,
  hebrew: string,
  words: TextWord[],
): Map<number, LexemeId[]> | null {
  const parsed = parse.verses[verseKey];
  if (!parsed) return null;

  const perWord = parse.realigned[verseKey] ?? stemsByPosition(parsed);
  const bhsaWords = wordsBhsaParsed(hebrew);
  if (bhsaWords.length !== perWord.length) return null;

  const named = new Map<number, LexemeId[]>();
  bhsaWords.forEach((word, i) => {
    if (perWord[i].length > 0) named.set(word.start, perWord[i]);
  });
  nameKetiv(hebrew, named, words);
  return named;
}

/** The stem of each printed word: the last of its morphemes. */
function stemsByPosition([morphemes, lengths]: ParsedVerse): LexemeId[][] {
  let at = 0;
  let stem: LexemeId | null = null;
  return lengths.map((length) => {
    // A word of no morphemes is a further part of the dictionary word before
    // it — the קַיִן of תּוּבַל קַיִן — so it carries that word's stem.
    if (length > 0) {
      stem = morphemes[at + length - 1][0];
      at += length;
    }
    return stem === null ? [] : [stem];
  });
}

const CORRECTION = new RegExp(`${KETIV.source}|${QERE.source}`, 'g');

/**
 * Give each ketiv the words BHSA parsed for the qere printed beside it, which
 * is the same word written differently. Word for word where the two have as
 * many words; otherwise each written word is every word it is read as — בגד is
 * read בָּא גָד, "Gad has come". A ketiv with no qere beside it is written and
 * not read, and BHSA has no word for it.
 */
function nameKetiv(hebrew: string, named: Map<number, LexemeId[]>, words: TextWord[]): void {
  if (!hebrew.includes('(')) return;
  const groups = [...hebrew.matchAll(CORRECTION)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    ketiv: m[0].startsWith('('),
  }));
  const within = (group: { start: number; end: number }) =>
    words.filter((w) => w.start >= group.start && w.start < group.end);
  // A qere belongs to one ketiv, with nothing but word breaks between them. In
  // (K1) [Q1] (K2) [Q2], Q1 is beside K2 too.
  const claimed = new Set<number>();
  const free = (i: number) => groups[i] && !groups[i].ketiv && !claimed.has(i);

  groups.forEach((group, i) => {
    if (!group.ketiv) return;
    const at =
      free(i + 1) && onlySeparators(hebrew, group.end, groups[i + 1].start)
        ? i + 1
        : free(i - 1) && onlySeparators(hebrew, groups[i - 1].end, group.start)
          ? i - 1
          : null;
    if (at === null) return;
    claimed.add(at);
    const qere = groups[at];

    const written = within(group);
    const read = within(qere).map((w) => named.get(w.start) ?? []);
    const all = [...new Set(read.flat())];
    written.forEach((w, j) => {
      const words = written.length === read.length ? read[j] : all;
      if (words.length > 0) named.set(w.start, words);
    });
  });
}

/** The dictionary words at a position in this text, if these are its words. */
function namedAt(
  words: VerseWords | null,
  verseText: string,
  wordStart: number,
): LexemeId[] | null {
  if (!words || words.hebrew !== verseText) return null;
  return words.named.get(wordStart) ?? null;
}

/** The dictionary words of the nth printed word of a verse, as BHSA parsed it. */
function namedWord(
  words: VerseWords | null,
  verseKey: string,
  wordIndex: number,
): LexemeId[] | null {
  if (!words || words.verseKey !== verseKey) return null;
  const word = words.clickable[wordIndex];
  return word ? (words.named.get(word.start) ?? null) : null;
}

/**
 * Is the word at this place in the verse one of the given meanings?
 *
 * The question `formMatches` answers is whether a spelling *could* be one of
 * them, which cannot separate the two words spelled עלה in Genesis 8:20. This
 * one names the word instead, and falls back to the spelling wherever the
 * parse cannot: a ketiv with no qere, a verse that does not line up, or a verse
 * drawn without the parse.
 *
 * `wordStart` is where the word begins in the nikkud-stripped text, which is
 * what the caller splits into words.
 */
export function wordMatches(
  dictionary: Dictionary,
  words: VerseWords | null,
  keys: readonly string[],
  writtenForm: string,
  verseText: string,
  wordStart: number,
): boolean {
  const named = namedAt(words, verseText, mapStrippedToOriginal(verseText, wordStart));
  if (named === null) return formMatches(dictionary, keys, writtenForm);
  const wanted = lexemesForKeys(dictionary, keys);
  return named.some((id) => wanted.has(id));
}
