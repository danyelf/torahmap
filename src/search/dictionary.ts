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
// not decoration: 461 lexemes share an ETCBC id with another, always a Hebrew
// word and an Aramaic one, and `<LH/` is both burnt-offering and pretext.

import {
  findLexemesForWord,
  getLexeme,
  getLexemeVerseCount,
  getVerseLexemes,
  searchByLexemes,
  type LexemeId,
} from '../search.ts';

/**
 * One dictionary word a written form might be, as a reader sees it.
 *
 * Usually one ETCBC lexeme, hence usually one key. Sometimes more: ETCBC gives
 * separate entries to different people bearing the same name, so 71 written
 * forms offer candidates identical in spelling, gloss, part of speech and
 * language. Two identical checkboxes are worse than one, so those become a
 * single row covering every lexeme behind it.
 */
export interface Meaning {
  /** Stable across regeneration of the index: ETCBC id and language. */
  keys: string[];
  /** Vocalized dictionary form, for display: עֹלָה */
  form: string;
  /** English gloss: "burnt-offering" */
  gloss: string;
  /** ETCBC part of speech: subs, verb, nmpr, ... */
  pos: string;
  language: 'heb' | 'arc';
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
 * The spelling alone is ambiguous for half of the words in the text, because
 * Hebrew does not write most vowels. The verse resolves nearly all of it: the
 * reading of the word in front of the reader is one the verse contains, and
 * the spelling's other candidates usually are not.
 *
 * This is inference, not knowledge. BHSA tags every occurrence with exactly one
 * lexeme, but the index is keyed by spelling, so the link is lost before it
 * reaches the browser. `verse-morphology.json` carries it — the length of each
 * printed word, whose last morpheme is its stem — so this body could become a
 * lookup off the word's own position. Until then the verse narrows rather than
 * decides, and can leave two readings standing: see `word-in-verse.test.ts`,
 * לו in Genesis 2:18.
 *
 * An empty result means "cannot say" — now rare, but real for a spelling the
 * dictionary does not carry and for the 64 verses in `misaligned`. Callers
 * offer a literal search rather than treating it as an error.
 */
export function meaningsInVerse(writtenForm: string, verseKey: string): Meaning[] {
  const ids = findLexemesForWord(writtenForm);
  if (!ids) return [];

  const inVerse = getVerseLexemes(verseKey);
  if (!inVerse) return [];

  const present = new Set(inVerse);
  return rowsFor(ids.filter((id) => present.has(id)));
}

/**
 * The verses carrying any of these meanings.
 *
 * Keys that no longer resolve are ignored rather than throwing, because they
 * arrive from URLs written against an older index.
 */
export function versesFor(keys: string[]): Set<string> {
  const ids: LexemeId[] = [];
  for (const key of keys) {
    const id = lexemeForKey(key);
    if (id !== null) ids.push(id);
  }
  if (ids.length === 0) return new Set();
  return searchByLexemes(ids);
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

  const wanted = new Set<LexemeId>();
  for (const key of keys) {
    const id = lexemeForKey(key);
    if (id !== null) wanted.add(id);
  }
  return ids.some((id) => wanted.has(id));
}
