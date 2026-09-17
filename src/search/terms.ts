// The list of search terms.
//
// A term is an object with an identity, and these functions are pure — each
// returns a new list. The identity is what keeps a term's choice of meanings
// attached to it: a term addressed by its position in a re-split string loses
// that choice the moment an earlier term is edited, because every later index
// shifts and the choice lands silently on a different word.

import { meaningsFor, sameMeaning, type Meaning } from './dictionary.ts';
import { isHebrewQuery } from '../search.ts';
import { TERM_SEPARATORS } from '../constants/app.ts';
import { SEARCH_COLORS } from '../utils/color.ts';

/**
 * How a term is matched. Meanings resolves a written form to the dictionary words
 * it could be, so it is offered only where there is a dictionary — Hebrew.
 */
export type SearchMode = 'substring' | 'word' | 'meanings';

export const SEARCH_MODES = [
  'substring',
  'word',
  'meanings',
] as const satisfies readonly SearchMode[];

export interface SearchTerm {
  /** Stable for the life of the term; survives edits to its text. */
  id: string;
  /** What the reader typed. */
  text: string;
  /** The dictionary words this text could be, likeliest reading first. */
  meanings: Meaning[];
  /**
   * Which meanings are checked, held as the first key of each chosen row.
   * Always explicit, so "all of them" is a full set rather than an empty one
   * that would read as "none".
   */
  selected: Set<string>;
  /** Position in SEARCH_COLORS, held for the term's life. */
  colorIndex: number;
  /**
   * How this term is matched, or null while the reader has not said.
   *
   * Null is not substring: a term's language follows its text, which changes as
   * it is typed, so a word retyped in the other script has to pick up that
   * language's default rather than keep the one it was created with.
   */
  mode: SearchMode | null;
}

/**
 * SEARCH_COLORS is indexed modulo its length, so a sixth term would repeat the
 * first one's colour and the map could no longer say which word is which. The
 * comma box made a sixth term awkward enough to be rare; a button makes it one
 * click, so the limit has to be stated rather than left to friction.
 */
export const MAX_TERMS = SEARCH_COLORS.length;

let nextId = 0;

function resolve(text: string): { meanings: Meaning[]; selected: Set<string> } {
  const meanings = meaningsFor(text.trim());
  return { meanings, selected: new Set(meanings.map((m) => m.keys[0])) };
}

/** The lowest colour no current term is using. */
function freeColor(terms: SearchTerm[]): number {
  const taken = new Set(terms.map((t) => t.colorIndex));
  for (let i = 0; i < MAX_TERMS; i++) {
    if (!taken.has(i)) return i;
  }
  return 0;
}

export function addTerm(terms: SearchTerm[], text: string): SearchTerm[] {
  if (terms.length >= MAX_TERMS) return terms;
  return [
    ...terms,
    { id: `t${nextId++}`, text, ...resolve(text), colorIndex: freeColor(terms), mode: null },
  ];
}

export function removeTerm(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.filter((t) => t.id !== id);
}

/**
 * Change a term's text, which re-resolves its meanings and checks all of them
 * again. Other terms are untouched — that is the whole point of the identity.
 *
 * A separator still means "another word": the comma box is gone, but readers
 * type commas out of habit and old URLs are full of them. Splitting on the same
 * set `parseSearchTerms` reads keeps the invariant the URL depends on — no
 * term's text holds a character that would later split it in two.
 */
export function setTermText(terms: SearchTerm[], id: string, text: string): SearchTerm[] {
  // `text` is kept exactly as the box holds it, trailing space and all, so the
  // input element and the term never disagree about what is written. Trimming
  // happens where it matters: resolving meanings, and building the query.
  const parts = TERM_SEPARATORS.test(text)
    ? text
        .split(TERM_SEPARATORS)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    : [text];
  const replacement = parts.length > 0 ? parts : [''];

  const index = terms.findIndex((t) => t.id === id);
  if (index === -1) return terms;

  // The first part stays this term, so its id and colour survive the edit.
  const edited = { ...terms[index], text: replacement[0], ...resolve(replacement[0]) };
  let out = [...terms.slice(0, index), edited, ...terms.slice(index + 1)];

  // Any further parts become terms of their own, until the colours run out.
  for (const extra of replacement.slice(1)) {
    const grown = addTerm(out, extra);
    if (grown.length === out.length) break;
    out = grown;
  }
  return out;
}

/**
 * Check or uncheck one meaning of one term.
 *
 * Unchecking the last checked meaning does nothing. A term matching nothing by
 * construction is a dead state with no reading, so the last checkbox holds.
 */
export function toggleMeaning(terms: SearchTerm[], id: string, key: string): SearchTerm[] {
  return terms.map((t) => {
    if (t.id !== id) return t;

    const selected = new Set(t.selected);
    if (selected.has(key)) {
      if (selected.size === 1) return t;
      selected.delete(key);
    } else {
      selected.add(key);
    }
    return { ...t, selected };
  });
}

/**
 * Every lexeme the term's checked meanings stand for, ready for `versesFor`.
 *
 * A merged row can cover more than one lexeme (see `rowsFor`), so this expands
 * each chosen row to all of them.
 */
export function selectedKeys(term: SearchTerm): string[] {
  return term.meanings.filter((m) => term.selected.has(m.keys[0])).flatMap((m) => m.keys);
}

/**
 * The narrowed meanings, for the URL's `m` parameter.
 *
 * Positional alongside the comma-separated terms in `q`: one entry per term,
 * `|` between the lexemes of one term, and an empty entry for a term the reader
 * has not narrowed. A search with nothing narrowed writes nothing at all, so an
 * ordinary URL is unchanged.
 *
 * Positions are safe here in a way they are not in the live list, because `q`
 * and `m` are written and read as one snapshot. It is editing that needs
 * identity.
 *
 * The keys go in as they are. `m` is declared a `names` parameter rather than
 * free text, which is what keeps the URL layer from stripping them: ETCBC
 * writes ayin as `<` and aleph as `>`, so two keys side by side read as an
 * HTML tag.
 */
export function encodeMeanings(terms: SearchTerm[]): string {
  const narrowed = terms.map((t) =>
    t.selected.size === t.meanings.length ? '' : selectedKeys(t).join('|'),
  );
  return narrowed.some((entry) => entry !== '') ? narrowed.join(',') : '';
}

/**
 * Apply an `m` parameter to a freshly built term list.
 *
 * A row counts as chosen when the parameter names any of its lexemes, not all
 * of them, so a URL written before two entries were merged still selects the
 * merged row. A term left with nothing selected — every key gone from the
 * dictionary, or an entry naming words this term cannot be — falls back to all
 * of its meanings rather than matching nothing.
 */
export function applyMeanings(terms: SearchTerm[], encoded: string): SearchTerm[] {
  if (!encoded) return terms;

  const perTerm = encoded.split(',');
  return terms.map((term, i) => {
    const entry = perTerm[i];
    if (!entry) return term;

    const named = entry.split('|');
    const selected = new Set(
      term.meanings.filter((m) => sameMeaning(m, named)).map((m) => m.keys[0]),
    );

    return selected.size === 0 ? term : { ...term, selected };
  });
}

/**
 * Narrow a term to a single meaning, named by any of the lexemes it stands for.
 *
 * Unchecking the others one at a time is fine for the 91% of ambiguous forms
 * that offer two or three, and tedious for the rest — אלה offers ten.
 *
 * The keys can come from a row this term does not hold. A reader choosing from
 * the word panel picks a row the verse built, and the verse's list can head a
 * reading with a different lexeme than the term's own list does. So the row is
 * found by any shared lexeme, and what goes into `selected` is that row's own
 * first key rather than whichever key was handed in: `selectedKeys`, the
 * checkboxes and the URL all read `selected` as first keys of this term's rows,
 * and a key belonging to some other list would be silently absent from all of
 * them.
 */
export function onlyMeaning(
  terms: SearchTerm[],
  id: string,
  keys: readonly string[],
): SearchTerm[] {
  return terms.map((t) => {
    if (t.id !== id) return t;
    const row = t.meanings.find((m) => sameMeaning(m, keys));
    return row ? { ...t, selected: new Set([row.keys[0]]) } : t;
  });
}

/** Put every meaning back, undoing a narrowing. */
export function allMeanings(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.map((t) =>
    t.id === id ? { ...t, selected: new Set(t.meanings.map((m) => m.keys[0])) } : t,
  );
}

/**
 * Has the reader narrowed this term? False for a word with one meaning, where
 * the single meaning is already all of them and there is nothing to restore.
 */
export function isNarrowed(term: SearchTerm): boolean {
  return term.meanings.length > 1 && term.selected.size < term.meanings.length;
}

/**
 * The colour slot occupied by the term at this position among the searched terms.
 *
 * A result, a snippet and a highlight all name a term by its position in the
 * searched list; the swatch and the map ask the term itself. Those were the
 * same number until a term gained a colour that survives its neighbours being
 * edited — delete the first of two terms and the survivor keeps colour 1 while
 * moving to position 0 — so the translation belongs in one place.
 */
export function colorIndexAt(terms: SearchTerm[], position: number): number {
  return terms[position]?.colorIndex ?? 0;
}

/** Change how one term is matched. */
export function setMode(terms: SearchTerm[], id: string, mode: SearchMode): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, mode } : t));
}

/**
 * What the reader chose, or the default for the language the text is in.
 *
 * English has no dictionary, so meanings is clamped to whole word here rather
 * than in the field: a term briefly retyped in English is back on meanings the
 * moment it is Hebrew again.
 */
export function effectiveMode(term: SearchTerm): SearchMode {
  const hebrew = isHebrewQuery(term.text.trim());
  const chosen = term.mode ?? (hebrew ? 'meanings' : 'substring');
  return !hebrew && chosen === 'meanings' ? 'word' : chosen;
}

/** The modes this term's own text can be matched by, in the order shown. */
export function modesOffered(term: SearchTerm): SearchMode[] {
  return isHebrewQuery(term.text.trim())
    ? ['substring', 'word', 'meanings']
    : ['substring', 'word'];
}

/**
 * One letter per mode, because the URL layer caps a token at 50 characters and
 * five terms spelled out would be 49 of them.
 */
const MODE_LETTERS: Record<SearchMode, string> = {
  substring: 's',
  word: 'w',
  meanings: 'm',
};

const MODE_BY_LETTER = new Map<string, SearchMode>(
  SEARCH_MODES.map((mode) => [MODE_LETTERS[mode], mode]),
);

/**
 * The chosen modes, for the URL's `mode` parameter.
 *
 * Positional alongside the comma-separated terms in `q`, exactly as `m` is:
 * one entry per term, and an empty entry for a term still on its default. A
 * search where nobody has chosen writes nothing at all, so an ordinary link is
 * unchanged.
 */
export function encodeModes(terms: SearchTerm[]): string {
  const letters = terms.map((t) => (t.mode ? MODE_LETTERS[t.mode] : ''));
  return letters.some((letter) => letter !== '') ? letters.join(',') : '';
}

/**
 * Apply a `mode` parameter to a freshly built term list.
 *
 * An entry that is empty or unrecognised leaves that term on its default,
 * rather than discarding the term or the search.
 */
export function applyModes(terms: SearchTerm[], encoded: string): SearchTerm[] {
  if (!encoded) return terms;

  const perTerm = encoded.split(',');
  return terms.map((term, i) => {
    const mode = MODE_BY_LETTER.get(perTerm[i]);
    return mode ? { ...term, mode } : term;
  });
}
