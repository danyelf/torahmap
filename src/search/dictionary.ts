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
  getLexeme,
  getLexemeVerseCount,
  getVerseLexemes,
  searchByLexemes,
  type Lexeme,
  type LexemeId,
} from '../search.ts';
import { fetchData } from '../constants.ts';
import { isReady, ready, type Loadable } from '../dataLoading.ts';
import { isHebrew, mapStrippedToOriginal, splitIntoWords, type TextWord } from '../hebrew.ts';
import { isSectionMarker, verseWords } from '../verseWords.ts';

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

function keyOf(id: LexemeId): string | null {
  const lexeme = getLexeme(id);
  return lexeme ? `${lexeme.id}@${lexeme.language}` : null;
}

// key -> lexeme, built on first use because the dictionary loads asynchronously.
let keyToLexeme: Map<string, LexemeId> | null = null;

function lexemeForKey(key: string): LexemeId | null {
  if (!keyToLexeme) {
    keyToLexeme = new Map();
    for (let id = 0; ; id++) {
      const k = keyOf(id);
      if (k === null) break;
      keyToLexeme.set(k, id);
    }
  }
  return keyToLexeme.get(key) ?? null;
}

/**
 * Merge a list of lexeme ids into the rows a reader sees, so that both
 * questions about a word share one answer shape.
 */
function rowsFor(ids: LexemeId[]): Meaning[] {
  // Merge as we go, so a merged row keeps the position of its likeliest member
  // and the order stays the order the data gave us.
  const rows = new Map<string, { meaning: Meaning; group: LexemeId[] }>();

  for (const id of ids) {
    const lexeme = getLexeme(id);
    const key = keyOf(id);
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
      verseCount: group.length === 1 ? getLexemeVerseCount(group[0]) : searchByLexemes(group).size,
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
 */
export function meaningsFor(writtenForm: string): Meaning[] {
  const ids = findLexemesForWord(writtenForm);
  if (!ids) return [];
  return rowsFor(ids);
}

/**
 * Which dictionary word is this written form, in this verse?
 *
 * Given `wordIndex` — which of the verse's printed words it is, counting from
 * zero the way `verseWords` does — this is a lookup rather than a guess,
 * and answers with the one word BHSA parsed there. It needs the verse to be
 * the one `setVerseOnScreen` last named, and its parse to have arrived.
 *
 * Without that, the verse narrows the spelling instead of settling it. Hebrew
 * does not write most vowels, so half the words in the text could be several
 * dictionary words; the reading in front of the reader is one the verse
 * contains and the spelling's other candidates usually are not. It can leave
 * two readings standing — see `word-in-verse.test.ts`, לו in Genesis 2:18.
 *
 * An empty result means "cannot say": a spelling the dictionary does not carry,
 * or one of the 64 verses in `misaligned`. Callers offer a literal search
 * rather than treating it as an error.
 */
export function meaningsInVerse(
  writtenForm: string,
  verseKey: string,
  wordIndex?: number,
): Meaning[] {
  const parsed = wordIndex === undefined ? null : stemOfWord(verseKey, wordIndex);
  if (parsed !== null) return rowForStem(parsed, writtenForm);

  const ids = findLexemesForWord(writtenForm);
  if (!ids) return [];

  const inVerse = getVerseLexemes(verseKey);
  if (!inVerse) return [];

  const present = new Set(inVerse);
  return rowsFor(ids.filter((id) => present.has(id)));
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
function rowForStem(stem: LexemeId, writtenForm: string): Meaning[] {
  const key = keyOf(stem);
  const candidates = findLexemesForWord(writtenForm) ?? [];
  const row = key === null ? undefined : rowsFor(candidates).find((m) => m.keys.includes(key));
  return row ? [row] : rowsFor([stem]);
}

/** The verses carrying any of these meanings. */
export function versesFor(keys: string[]): Set<string> {
  return searchByLexemes([...lexemesForKeys(keys)]);
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
export function formMatches(keys: string[], writtenForm: string): boolean {
  const ids = findLexemesForWord(writtenForm);
  if (!ids || ids.length === 0) return false;

  const wanted = lexemesForKeys(keys);
  return ids.some((id) => wanted.has(id));
}

function lexemesForKeys(keys: readonly string[]): Set<LexemeId> {
  const wanted = new Set<LexemeId>();
  for (const key of keys) {
    const id = lexemeForKey(key);
    if (id !== null) wanted.add(id);
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
// It costs 4.5 MB, which is more than the other three files together, and no
// reader needs it until a verse is on screen. So it is not part of startup:
// `prefetchMorphology` asks for it once the app has gone idle, and opening a
// verse asks for it outright. Until it lands every answer here is the one the
// spelling gives.

/** morphemes as [lexeme, parsing], morphemes per printed word, maqaf positions. */
type ParsedVerse = [Array<[LexemeId, number]>, number[], number[]];

interface MorphologyFile {
  misaligned: string[];
  verses: Record<string, ParsedVerse>;
}

let morphology: MorphologyFile | null = null;
let misaligned: Set<string> = new Set();

/**
 * The per-word parse, loaded once by `ready`. A failure is not fatal and is
 * not retried: every caller falls back to the spelling.
 */
const morphologyFile: Loadable = {
  id: 'the per-word parse',
  async init() {
    const res = await fetchData('search/verse-morphology.json');
    if (!res.ok) throw new Error(`Response status ${res.status}`);
    const file: MorphologyFile = await res.json();
    morphology = file;
    misaligned = new Set(file.misaligned);
  },
};

/**
 * Ask for the parse once the app has finished starting up, so that the reader
 * who opens a verse is not the one who waits for it.
 *
 * Scheduled rather than called, because the point is to stay off the critical
 * path: at the moment this runs the first frame has been drawn but the browser
 * may still be laying out and painting. Safari has no `requestIdleCallback`,
 * hence the timer; either way `ready` fetches once, so a verse opened before
 * this fires does not fetch again.
 */
export function prefetchMorphology(): void {
  if (typeof requestIdleCallback === 'function') {
    // The deadline matters more than the idleness: on a page that never goes
    // idle the callback must still run.
    requestIdleCallback(() => void ready(morphologyFile), { timeout: PREFETCH_TIMEOUT_MS });
  } else {
    setTimeout(() => void ready(morphologyFile), PREFETCH_TIMEOUT_MS);
  }
}

/** Long enough to be clear of first paint, short enough to beat a deliberate click. */
const PREFETCH_TIMEOUT_MS = 2000;

/**
 * The verse whose Hebrew is on screen, and its printed words' stems by where
 * each word starts in that text. Null stems mean the two sources divide this
 * verse differently, or the parse is not here yet.
 */
let onScreen: { verseKey: string; hebrew: string; stems: Map<number, LexemeId> | null } | null =
  null;

/**
 * Name the verse whose Hebrew is about to be displayed.
 *
 * The overlay that marks words inside a verse is handed the text without its
 * reference, so the verse has to be named separately by whoever is drawing it.
 *
 * Returns null when the parse is already in hand and nothing is waiting on it,
 * and otherwise a promise that resolves once it arrives, so the caller can
 * draw the verse again, this time with the words named. It resolves after a
 * failed load too; there is simply nothing more to wait for.
 */
export function setVerseOnScreen(verseKey: string, hebrew: string): Promise<void> | null {
  onScreen = { verseKey, hebrew, stems: stemsOf(verseKey, hebrew) };
  return isReady(morphologyFile) ? null : ready(morphologyFile);
}

/** Which verse the last `setVerseOnScreen` named, for callers checking staleness. */
export function verseOnScreen(): string | null {
  return onScreen?.verseKey ?? null;
}

/**
 * Did the parse line up with the verse on screen, so that its words are named
 * rather than guessed at?
 *
 * Exported for the tests, which ask it rather than repeat the check.
 */
export function wordsAreNamed(): boolean {
  return onScreen?.stems != null;
}

/** The ketiv, which BHSA carries no word for, so it cannot be counted past. */
const KETIV = /\([^)]*\)/g;

/**
 * The printed words BHSA has a word for, where each starts in the verse text.
 *
 * Not the section markers, and not the ketiv — the form Sefaria prints in
 * round brackets beside the qere, the word that is actually read. The ketiv is
 * blanked rather than deleted, so offsets keep meaning what they meant.
 *
 * Same rule as `displayed_words()` in scripts/search/generate-lexeme-index.py,
 * which is what the file was aligned against.
 */
function wordsBhsaParsed(hebrew: string): TextWord[] {
  const blanked = hebrew.replace(KETIV, (m) => ' '.repeat(m.length));
  return splitIntoWords(blanked).filter(({ word }) => !isSectionMarker(word) && isHebrew(word));
}

/**
 * Where each printed word of a verse starts, and which dictionary word it is.
 *
 * Null rather than a partial answer whenever anything fails to line up. The
 * file names 64 verses where BHSA and Sefaria divide a compound name
 * differently; the word count is checked again here anyway, because a position
 * that is one word out labels every word after it with its neighbour's
 * dictionary entry — wrong, and plausible enough to go unnoticed.
 */
function stemsOf(verseKey: string, hebrew: string): Map<number, LexemeId> | null {
  const parsed = morphology?.verses[verseKey];
  if (!parsed || misaligned.has(verseKey)) return null;

  const [morphemes, lengths] = parsed;
  const words = wordsBhsaParsed(hebrew);
  if (words.length !== lengths.length) return null;

  const stems = new Map<number, LexemeId>();
  let at = 0;
  let stem: LexemeId | null = null;

  for (let i = 0; i < lengths.length; i++) {
    // A word of no morphemes is a further part of the dictionary word before
    // it — the קַיִן of תּוּבַל קַיִן — so it carries that word's stem.
    if (lengths[i] > 0) {
      stem = morphemes[at + lengths[i] - 1][0];
      at += lengths[i];
    }
    if (stem !== null) stems.set(words[i].start, stem);
  }

  return stems;
}

/** The dictionary word at a position in the text on screen, if that is what this is. */
function stemAt(verseText: string, wordStart: number): LexemeId | null {
  if (!onScreen?.stems || onScreen.hebrew !== verseText) return null;
  return onScreen.stems.get(wordStart) ?? null;
}

/** The nth printed word of a verse, as BHSA parsed it. */
function stemOfWord(verseKey: string, wordIndex: number): LexemeId | null {
  if (!onScreen?.stems || onScreen.verseKey !== verseKey) return null;

  const word = verseWords(onScreen.hebrew)[wordIndex];
  return word ? (onScreen.stems.get(word.start) ?? null) : null;
}

/**
 * Is the word at this place in the verse one of the given meanings?
 *
 * The question `formMatches` answers is whether a spelling *could* be one of
 * them, which cannot separate the two words spelled עלה in Genesis 8:20. This
 * one names the word instead, and falls back to the spelling wherever the
 * parse cannot: a ketiv, a verse that does not line up, or the moments before
 * the parse has loaded.
 *
 * `wordStart` is where the word begins in the nikkud-stripped text, which is
 * what the caller splits into words.
 */
export function wordMatches(
  keys: string[],
  writtenForm: string,
  verseText: string,
  wordStart: number,
): boolean {
  const stem = stemAt(verseText, mapStrippedToOriginal(verseText, wordStart));
  if (stem === null) return formMatches(keys, writtenForm);
  return lexemesForKeys(keys).has(stem);
}
