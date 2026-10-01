// The list of search terms.
//
// A term is an object with an identity, and these functions are pure — each
// returns a new list. The identity is what keeps a term's choice of meanings
// attached to it: a term addressed by its position in a re-split string loses
// that choice the moment an earlier term is edited, because every later index
// shifts and the choice lands silently on a different word.

import { meaningsFor, sameMeaning, versesFor, type Meaning } from './dictionary.ts';
import {
  resultsForVerseSets,
  versesForTerm,
  type Dictionary,
  type SearchResult,
  type TextIndex,
} from '../search.ts';
import { isHebrew, splitIntoWords } from '../hebrew.ts';
import { TERM_SEPARATORS } from './constants.ts';
import { SEARCH_COLORS } from '../utils/color.ts';
import { ENGLISH, HEBREW, type TextLanguage } from '../types.ts';
import type { MatchMode } from './matching.ts';

/**
 * How a term is matched. Meanings resolves a written form to the dictionary words
 * it could be, so it is offered only where there is a dictionary — Hebrew.
 */
export type SearchMode = MatchMode | 'meanings';

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
  /**
   * The meanings chosen, as dictionary keys; null when every meaning is.
   *
   * Kept as the reader or the link gave them and never looked up, so a term
   * made before the dictionary is in loses nothing. A row counts as chosen when
   * it shares a key with this list (sameMeaning); a list naming no row the term
   * has counts every row as chosen.
   */
  chosen: string[] | null;
}

/**
 * One colour per term. SEARCH_COLORS is indexed modulo its length, so one more
 * term would repeat the first one's colour.
 */
export const MAX_TERMS = SEARCH_COLORS.length;

let nextId = 0;

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
    { id: `t${nextId++}`, text, colorIndex: freeColor(terms), mode: null, chosen: null },
  ];
}

export function removeTerm(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.filter((t) => t.id !== id);
}

/**
 * Change a term's text, which chooses every meaning of the new text. Other
 * terms are untouched — that is the whole point of the identity.
 *
 * A separator means "another word", as it does to `parseSearchTerms`, which
 * keeps the invariant the URL depends on: no term's text holds a character
 * that would later split it in two.
 */
export function setTermText(terms: SearchTerm[], id: string, text: string): SearchTerm[] {
  // `text` is kept exactly as the box holds it, trailing space and all, so the
  // input element and the term never disagree about what is written. Trimming
  // happens where it matters: looking up meanings, and building the query.
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
  const edited = { ...terms[index], text: replacement[0], chosen: null };
  let out = [...terms.slice(0, index), edited, ...terms.slice(index + 1)];

  // Any further parts become terms of their own, until the colours run out.
  for (const extra of replacement.slice(1)) {
    const grown = addTerm(out, extra);
    if (grown.length === out.length) break;
    out = grown;
  }
  return out;
}

/** The dictionary words this term's text could be, likeliest reading first. */
export function meaningsOf(dictionary: Dictionary, term: SearchTerm): Meaning[] {
  return meaningsFor(dictionary, term.text.trim());
}

/** Which of `rows`, the term's own meanings, count as chosen. */
export function chosenAmong(rows: Meaning[], term: SearchTerm): Meaning[] {
  const { chosen } = term;
  if (chosen === null) return rows;
  const named = rows.filter((m) => sameMeaning(m, chosen));
  return named.length > 0 ? named : rows;
}

/** The term's meanings that count as chosen. */
export function chosenMeanings(dictionary: Dictionary, term: SearchTerm): Meaning[] {
  return chosenAmong(meaningsOf(dictionary, term), term);
}

/**
 * Check or uncheck one meaning of one term, named by any of its keys.
 *
 * Unchecking the last checked meaning does nothing. A term matching nothing by
 * construction is a dead state with no reading, so the last checkbox holds.
 * Checking every meaning again leaves nothing narrowed.
 */
export function toggleMeaning(
  dictionary: Dictionary,
  terms: SearchTerm[],
  id: string,
  keys: readonly string[],
): SearchTerm[] {
  return terms.map((t) => {
    if (t.id !== id) return t;

    const rows = meaningsOf(dictionary, t);
    const row = rows.find((m) => sameMeaning(m, keys));
    if (!row) return t;

    const current = chosenAmong(rows, t);
    const checked = current.includes(row);
    if (checked && current.length === 1) return t;

    const next = rows.filter((m) => (m === row ? !checked : current.includes(m)));
    return { ...t, chosen: next.length === rows.length ? null : next.flatMap((m) => m.keys) };
  });
}

/**
 * Every lexeme the term's checked meanings stand for, ready for `versesFor`.
 *
 * A merged row can cover more than one lexeme (see `rowsFor`), so this expands
 * each chosen row to all of them.
 */
export function selectedKeys(dictionary: Dictionary, term: SearchTerm): string[] {
  return chosenMeanings(dictionary, term).flatMap((m) => m.keys);
}

/**
 * The narrowed meanings, for the URL's `m` parameter.
 *
 * Positional alongside the comma-separated terms in `search`: one entry per term,
 * `|` between the lexemes of one term, and an empty entry for a term the reader
 * has not narrowed. A search with nothing narrowed writes nothing at all, so an
 * ordinary URL is unchanged.
 *
 * Positions are safe here in a way they are not in the live list, because `search`
 * and `m` are written and read as one snapshot. It is editing that needs
 * identity.
 *
 * The keys go in as `chosen` holds them, so writing a link needs no dictionary.
 * `m` is declared a `names` parameter rather than free text, which is what
 * keeps the URL layer from stripping them: ETCBC writes ayin as `<` and aleph
 * as `>`, so two keys side by side read as an HTML tag.
 */
export function encodeMeanings(terms: SearchTerm[]): string {
  const narrowed = terms.map((t) => t.chosen?.join('|') ?? '');
  return narrowed.some((entry) => entry !== '') ? narrowed.join(',') : '';
}

/**
 * Apply an `m` parameter to a freshly built term list: each entry becomes that
 * term's `chosen`, as written. An empty entry leaves the term on every meaning.
 */
export function applyMeanings(terms: SearchTerm[], encoded: string): SearchTerm[] {
  if (!encoded) return terms;

  const perTerm = encoded.split(',');
  return terms.map((term, i) => (perTerm[i] ? { ...term, chosen: perTerm[i].split('|') } : term));
}

/**
 * Narrow a term to a single meaning, named by every lexeme its row stands for.
 *
 * Unchecking the others one at a time is fine for the 91% of ambiguous forms
 * that offer two or three, and tedious for the rest — אלה offers ten.
 *
 * The keys can come from a row this term does not hold: a reader choosing from
 * the word panel picks a row the verse built, and the verse's list can head a
 * reading with another lexeme, or hold fewer of a merged row's lexemes, than
 * the term's own list. They are kept as given; wherever the choice is read,
 * sameMeaning finds the term's row by any lexeme the two share.
 */
export function onlyMeaning(
  terms: SearchTerm[],
  id: string,
  keys: readonly string[],
): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, chosen: [...keys] } : t));
}

/** Put every meaning back, undoing a narrowing. */
export function allMeanings(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, chosen: null } : t));
}

/**
 * Has the reader narrowed this term? False for a word with one meaning, where
 * the single meaning is already all of them and there is nothing to restore.
 */
export function isNarrowed(dictionary: Dictionary, term: SearchTerm): boolean {
  const rows = meaningsOf(dictionary, term);
  return rows.length > 1 && chosenAmong(rows, term).length < rows.length;
}

/**
 * The colour slot occupied by the term at this position among the searched terms.
 *
 * A result, a snippet and a highlight all name a term by its position in the
 * searched list; the swatch and the map ask the term itself. A term's colour
 * survives its neighbours being edited — delete the first of two terms and the
 * survivor keeps colour 1 at position 0 — so the translation belongs in one
 * place.
 */
export function colorIndexAt(terms: SearchTerm[], position: number): number {
  return terms[position]?.colorIndex ?? 0;
}

/** Change how one term is matched. */
export function setMode(terms: SearchTerm[], id: string, mode: SearchMode): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, mode } : t));
}

/** Each term's own language, decided by its own text. */
export function termIsHebrew(term: SearchTerm): boolean {
  return isHebrew(term.text);
}

/**
 * What the reader chose, or the default for the language the text is in.
 *
 * Where meanings is not possible it is clamped to whole word here rather than
 * in the field: a term briefly retyped as English, or as a phrase, is back on
 * meanings the moment it is a Hebrew word again.
 */
export function effectiveMode(dictionary: Dictionary | null, term: SearchTerm): SearchMode {
  const chosen = term.mode ?? (termIsHebrew(term) ? 'meanings' : 'substring');
  return chosen === 'meanings' && !meaningsPossible(dictionary, term) ? 'word' : chosen;
}

/**
 * Can this term be matched by meaning? Not in English, and not a Hebrew phrase
 * the dictionary does not have: it has בית אל, a name, but not וידבר יהוה. A
 * single word stays possible while it is being typed, though most of its
 * prefixes are no word at all. Without the dictionary, no phrase is.
 */
export function meaningsPossible(dictionary: Dictionary | null, term: SearchTerm): boolean {
  if (!termIsHebrew(term)) return false;
  if (splitIntoWords(term.text).length < 2) return true;
  return dictionary !== null && meaningsOf(dictionary, term).length > 0;
}

/** The modes this term's own text can be matched by, in the order shown. */
export function modesOffered(term: SearchTerm): SearchMode[] {
  return SEARCH_MODES.filter((mode) => mode !== 'meanings' || termIsHebrew(term));
}

/** Everything a term is matched on: terms with equal queries find the same verses. */
export type TermQuery = { text: string; language: TextLanguage } & (
  | {
      mode: 'meanings';
      /** The lexemes of the chosen meanings. Empty for a word the dictionary does not know. */
      meaningKeys: string[];
    }
  | { mode: MatchMode }
);

export function termQuery(dictionary: Dictionary, term: SearchTerm): TermQuery {
  const text = term.text.trim();
  const language = termIsHebrew(term) ? HEBREW : ENGLISH;
  const mode = effectiveMode(dictionary, term);
  return mode === 'meanings'
    ? { text, language, mode, meaningKeys: selectedKeys(dictionary, term) }
    : { text, language, mode };
}

/** The verses a query finds. A word the dictionary does not know finds none in meanings mode. */
export function versesForQuery(
  index: TextIndex,
  dictionary: Dictionary,
  query: TermQuery,
): Set<string> {
  return query.mode === 'meanings'
    ? versesFor(dictionary, query.meaningKeys)
    : versesForTerm(index, query.text, query.language, query.mode);
}

/** The verses these terms find, each naming the terms that found it. */
export function resultsForTerms(
  index: TextIndex,
  dictionary: Dictionary,
  terms: SearchTerm[],
): SearchResult[] {
  return resultsForVerseSets(
    index,
    terms.map((term) => versesForQuery(index, dictionary, termQuery(dictionary, term))),
  );
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
 * Positional alongside the comma-separated terms in `search`, exactly as `m` is:
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
