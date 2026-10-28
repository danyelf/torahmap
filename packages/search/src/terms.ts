// The list of search terms.
//
// A term is an object with an identity, and these functions are pure — each
// returns a new list. The identity is what keeps what a term has chosen
// attached to it: a term addressed by its position in a re-split string loses
// that choice the moment an earlier term is edited, because every later index
// shifts and the choice lands silently on a different word.

import { freeColor, PALETTE } from '@torahmap/shell/overlays/palette.ts';
import { MAX_PICKS } from '@torahmap/shell/overlays/picks.ts';
import { isSearchableWord } from '@torahmap/utils';
import { TERM_SEPARATORS } from './constants.ts';
import type { ExtraMode } from './extraMode.ts';
import type { SearchLanguage } from './language.ts';
import type { MatchMode } from './matching.ts';

const MATCH_MODES = ['substring', 'word'] as const satisfies readonly MatchMode[];

export interface SearchTerm {
  /** Stable for the life of the term; survives edits to its text. */
  id: string;
  /** What the reader typed. */
  text: string;
  /**
   * Place in PALETTE, held from when the term first has a word until it is emptied. An empty
   * term's is a placeholder: its colour is chosen when its first word is typed.
   */
  colorIndex: number;
  /**
   * How this term is matched — a MatchMode or an extra mode's id — or null
   * while the reader has not said.
   *
   * Null is not substring: a term's language follows its text, which changes as
   * it is typed, so a word retyped in another script has to pick up that
   * language's default rather than keep the one it was created with.
   */
  mode: string | null;
  /**
   * What the extra mode has chosen for this term, as it writes it; null for
   * nothing chosen. Kept as given and never looked up, so a term made before
   * the search's files are in loses nothing. Forgotten when the text changes.
   */
  chosen: string[] | null;
}

/**
 * One colour per term, and the picks keep the rest of PALETTE, so a colour is always left for
 * the next term or pick.
 */
export const MAX_TERMS = PALETTE.length - MAX_PICKS;

let nextId = 0;

/** The colours the terms hold: those with a word in them. */
export const heldColors = (terms: SearchTerm[]): number[] =>
  terms.filter((t) => t.text.trim()).map((t) => t.colorIndex);

/**
 * The terms with one more, in the first colour that neither a term nor `taken`, the colours the
 * picks hold, is using.
 */
export function addTerm(
  terms: SearchTerm[],
  text: string,
  taken: readonly number[] = [],
): SearchTerm[] {
  if (terms.length >= MAX_TERMS) return terms;
  const colorIndex = freeColor([...taken, ...heldColors(terms)]);
  return [...terms, { id: `t${nextId++}`, text, colorIndex, mode: null, chosen: null }];
}

export function removeTerm(terms: SearchTerm[], id: string): SearchTerm[] {
  return terms.filter((t) => t.id !== id);
}

/**
 * Change a term's text, which forgets what was chosen for the old text. Other
 * terms are untouched — that is the whole point of the identity.
 *
 * A separator means "another word", as it does to `parseSearchTerms`, which
 * keeps the invariant the URL depends on: no term's text holds a character
 * that would later split it in two.
 */
export function setTermText(
  terms: SearchTerm[],
  id: string,
  text: string,
  taken: readonly number[] = [],
): SearchTerm[] {
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

  // The first part stays this term, so its id survives the edit, and its colour too once it
  // has one; an empty term takes its colour with its first word.
  const [old, others] = [terms[index], terms.filter((t) => t.id !== id)];
  const colorIndex =
    old.text.trim() || !replacement[0].trim()
      ? old.colorIndex
      : freeColor([...taken, ...heldColors(others)]);
  const edited = { ...old, text: replacement[0], colorIndex, chosen: null };
  let out = [...terms.slice(0, index), edited, ...terms.slice(index + 1)];

  // Any further parts become terms of their own, until the colours run out.
  for (const extra of replacement.slice(1)) {
    const grown = addTerm(out, extra, taken);
    if (grown.length === out.length) break;
    out = grown;
  }
  return out;
}

/** The terms a query string names, dropping ones too short to search on. */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(TERM_SEPARATORS)
    .map((t) => t.trim())
    .filter(isSearchableWord);
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
export function setMode(terms: SearchTerm[], id: string, mode: string): SearchTerm[] {
  return terms.map((t) => (t.id === id ? { ...t, mode } : t));
}

/** The language of `text`: the first that claims it, else the last. */
export function languageFor(languages: readonly SearchLanguage[], text: string): SearchLanguage {
  return languages.find((l) => l.claims(text)) ?? languages[languages.length - 1];
}

/** Each term's own language, decided by its own text. */
export function languageOf(languages: readonly SearchLanguage[], term: SearchTerm): SearchLanguage {
  return languageFor(languages, term.text);
}

/**
 * What the reader chose, or the default for the term's language.
 *
 * Where the extra mode is not possible it is clamped to whole word here rather
 * than in the field: a term briefly retyped so that it cannot be matched that
 * way is back on it the moment it can.
 */
export function effectiveMode<X>(
  term: SearchTerm,
  languages: readonly SearchLanguage[],
  extra?: ExtraMode<X>,
  x: X | null = null,
  defaultMode: MatchMode = 'substring',
): string {
  const language = languageOf(languages, term);
  const chosen = term.mode ?? (extra?.isDefault(term, language) ? extra.id : defaultMode);
  if (chosen !== extra?.id) return chosen;
  return extra.possible(x, term, language) ? chosen : 'word';
}

/** The modes this term's own text can be matched by, in the order shown. */
export function modesOffered<X>(
  term: SearchTerm,
  languages: readonly SearchLanguage[],
  extra?: ExtraMode<X>,
): string[] {
  const offered = extra?.offered(term, languageOf(languages, term));
  return offered ? [...MATCH_MODES, extra!.id] : [...MATCH_MODES];
}

/**
 * One letter per mode, because the URL layer caps a token at 50 characters and
 * five terms spelled out would be 49 of them.
 */
const MODE_LETTERS: Record<MatchMode, string> = { substring: 's', word: 'w' };

function lettersFor<X>(extra?: ExtraMode<X>): Map<string, string> {
  const letters = new Map<string, string>(Object.entries(MODE_LETTERS));
  if (extra) letters.set(extra.id, extra.letter);
  return letters;
}

/**
 * The chosen modes, for the URL's `mode` parameter.
 *
 * Positional alongside the comma-separated terms in `search`: one entry per
 * term, and an empty entry for a term still on its default. A search where
 * nobody has chosen writes nothing at all, so an ordinary link is unchanged.
 */
export function encodeModes<X>(terms: SearchTerm[], extra?: ExtraMode<X>): string {
  const letters = lettersFor(extra);
  const written = terms.map((t) => (t.mode ? (letters.get(t.mode) ?? '') : ''));
  return written.some((letter) => letter !== '') ? written.join(',') : '';
}

/**
 * Apply a `mode` parameter to a freshly built term list.
 *
 * An entry that is empty or unrecognised leaves that term on its default,
 * rather than discarding the term or the search.
 */
export function applyModes<X>(
  terms: SearchTerm[],
  encoded: string,
  extra?: ExtraMode<X>,
): SearchTerm[] {
  if (!encoded) return terms;

  const byLetter = new Map([...lettersFor(extra)].map(([mode, letter]) => [letter, mode]));
  const perTerm = encoded.split(',');
  return terms.map((term, i) => {
    const mode = byLetter.get(perTerm[i]);
    return mode ? { ...term, mode } : term;
  });
}
