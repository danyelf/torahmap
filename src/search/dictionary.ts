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

  // Merge as we go, so a merged row keeps the position of its likeliest member
  // and the order stays the order the data gave us.
  const rows = new Map<string, { meaning: Meaning; group: LexemeId[] }>();

  for (const id of ids) {
    const lexeme = getLexeme(id);
    const key = keyOf(id);
    if (!lexeme || key === null) continue;

    const row = rows.get(renderedAs(lexeme));
    if (row) {
      row.meaning.keys.push(key);
      row.group.push(id);
      continue;
    }

    rows.set(renderedAs(lexeme), {
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

  return [...rows.values()].map(({ meaning, group }) => ({
    ...meaning,
    verseCount: group.length === 1 ? getLexemeVerseCount(group[0]) : searchByLexemes(group).size,
  }));
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
