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
  getLexemeVerseCount,
  getVerseLexemes,
  searchByLexemes,
  type Lexeme,
  type LexemeId,
} from '../search.ts';
import { fetchData } from '../constants.ts';
import {
  KETIV,
  QERE,
  isHebrew,
  isWordSeparator,
  mapStrippedToOriginal,
  splitIntoWords,
  stripNikkud,
  withFinalLetter,
  type TextWord,
} from '../hebrew.ts';
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
 * zero the way `verseWords` does — this is a lookup rather than a guess, and
 * answers with the words BHSA parsed there: one, or two for a ketiv read as
 * two (בגד, read בָּא גָד) or a word the page prints solid (הללויה). It needs the verse to be
 * the one `setVerseOnScreen` last named, and its parse to have arrived.
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
  writtenForm: string,
  verseKey: string,
  wordIndex?: number,
): Meaning[] {
  const parsed = wordIndex === undefined ? null : namedWord(verseKey, wordIndex);
  if (parsed !== null) return parsed.flatMap((id) => rowForLexeme(id, writtenForm));

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
function rowForLexeme(id: LexemeId, writtenForm: string): Meaning[] {
  const key = keyOf(id);
  const candidates = findLexemesForWord(writtenForm) ?? [];
  const row = key === null ? undefined : rowsFor(candidates).find((m) => m.keys.includes(key));
  return row ? [row] : rowsFor([id]);
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
export function spellingFor(keys: readonly string[], clicked: string): string | null {
  const has = (text: string) => formMatches(keys, text);
  if (has(clicked)) return clicked;

  const ids = [...lexemesForKeys(keys)];
  for (const id of ids) {
    const spelling = stripNikkud(getLexeme(id)?.form ?? '');
    if (spelling && has(spelling)) return spelling;
  }
  // The index keeps its spellings folded; the search box shows them as printed.
  const printed = ids.map(printedSpelling).find(Boolean);
  return printed ? withFinalLetter(printed) : null;
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
export function formMatches(keys: readonly string[], writtenForm: string): boolean {
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
  /** For the verses the page divides into words differently: each shown word's lexemes. */
  realigned: Record<string, LexemeId[][]>;
  verses: Record<string, ParsedVerse>;
}

let morphology: MorphologyFile | null = null;
let loading: Promise<void> | null = null;
let settled = false;

/**
 * Fetch the per-word parse, once.
 *
 * A failure is not fatal and is not retried: every caller falls back to the
 * spelling. `settled` says the attempt is over either way, so a caller waiting
 * to redraw is released rather than left asking again.
 */
function loadMorphology(): Promise<void> {
  loading ??= fetchData('search/verse-morphology.json')
    .then(async (res) => {
      if (!res.ok) throw new Error(`Response status ${res.status}`);
      const file: MorphologyFile = await res.json();
      morphology = file;
    })
    .catch((err) => {
      console.warn('Could not load the per-word parse; falling back to the spelling:', err);
    })
    .finally(() => {
      settled = true;
    });
  return loading;
}

/**
 * Ask for the parse once the app has finished starting up, so that the reader
 * who opens a verse is not the one who waits for it.
 *
 * Scheduled rather than called, because the point is to stay off the critical
 * path: at the moment this runs the first frame has been drawn but the browser
 * may still be laying out and painting. Safari has no `requestIdleCallback`,
 * hence the timer; either way the fetch is the same memoized one `loading`
 * guards, so a verse opened before this fires still fetches exactly once.
 */
export function prefetchMorphology(): void {
  if (typeof requestIdleCallback === 'function') {
    // The deadline matters more than the idleness: on a page that never goes
    // idle the callback must still run.
    requestIdleCallback(() => void loadMorphology(), { timeout: PREFETCH_TIMEOUT_MS });
  } else {
    setTimeout(() => void loadMorphology(), PREFETCH_TIMEOUT_MS);
  }
}

/** Long enough to be clear of first paint, short enough to beat a deliberate click. */
const PREFETCH_TIMEOUT_MS = 2000;

/**
 * The verse whose Hebrew is on screen, and the dictionary words of its printed
 * words by where each starts in that text. Null `named` means the parse is not
 * here yet, or its words do not line up with this text.
 */
let onScreen: { verseKey: string; hebrew: string; named: Map<number, LexemeId[]> | null } | null =
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
  onScreen = { verseKey, hebrew, named: namedWords(verseKey, hebrew) };
  return settled ? null : loadMorphology();
}

/** Which verse the last `setVerseOnScreen` named, for callers checking staleness. */
export function verseOnScreen(): string | null {
  return onScreen?.verseKey ?? null;
}

/** Does a click on this word of the verse on screen land on a word BHSA parsed? */
export function wordIsNamed(wordIndex: number): boolean {
  return onScreen !== null && namedWord(onScreen.verseKey, wordIndex) !== null;
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
function namedWords(verseKey: string, hebrew: string): Map<number, LexemeId[]> | null {
  const parsed = morphology?.verses[verseKey];
  if (!parsed) return null;

  const perWord = morphology?.realigned[verseKey] ?? stemsByPosition(parsed);
  const words = wordsBhsaParsed(hebrew);
  if (words.length !== perWord.length) return null;

  const named = new Map<number, LexemeId[]>();
  words.forEach((word, i) => {
    if (perWord[i].length > 0) named.set(word.start, perWord[i]);
  });
  nameKetiv(hebrew, named);
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
function nameKetiv(hebrew: string, named: Map<number, LexemeId[]>): void {
  if (!hebrew.includes('(')) return;
  const groups = [...hebrew.matchAll(CORRECTION)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    ketiv: m[0].startsWith('('),
  }));
  const words = verseWords(hebrew);
  const within = (group: { start: number; end: number }) =>
    words.filter((w) => w.start >= group.start && w.start < group.end);
  // Nothing but word breaks stands between a ketiv and its qere.
  const beside = (from: number, to: number) => [...hebrew.slice(from, to)].every(isWordSeparator);
  // A qere belongs to one ketiv. In (K1) [Q1] (K2) [Q2], Q1 is beside K2 too.
  const claimed = new Set<number>();
  const free = (i: number) => groups[i] && !groups[i].ketiv && !claimed.has(i);

  groups.forEach((group, i) => {
    if (!group.ketiv) return;
    const at =
      free(i + 1) && beside(group.end, groups[i + 1].start)
        ? i + 1
        : free(i - 1) && beside(groups[i - 1].end, group.start)
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

/** The dictionary words at a position in the text on screen, if that is what this is. */
function namedAt(verseText: string, wordStart: number): LexemeId[] | null {
  if (!onScreen?.named || onScreen.hebrew !== verseText) return null;
  return onScreen.named.get(wordStart) ?? null;
}

/** The dictionary words of the nth printed word of a verse, as BHSA parsed it. */
function namedWord(verseKey: string, wordIndex: number): LexemeId[] | null {
  if (!onScreen?.named || onScreen.verseKey !== verseKey) return null;

  const word = verseWords(onScreen.hebrew)[wordIndex];
  return word ? (onScreen.named.get(word.start) ?? null) : null;
}

/**
 * Is the word at this place in the verse one of the given meanings?
 *
 * The question `formMatches` answers is whether a spelling *could* be one of
 * them, which cannot separate the two words spelled עלה in Genesis 8:20. This
 * one names the word instead, and falls back to the spelling wherever the
 * parse cannot: a ketiv with no qere, a verse that does not line up, or the
 * moments before the parse has loaded.
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
  const named = namedAt(verseText, mapStrippedToOriginal(verseText, wordStart));
  if (named === null) return formMatches(keys, writtenForm);
  const wanted = lexemesForKeys(keys);
  return named.some((id) => wanted.has(id));
}
