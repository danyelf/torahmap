// The Tanakh's meanings mode: a term resolved to the dictionary words its text
// could be, narrowed to the ones the reader leaves checked. The term list
// itself is @torahmap/search's; this is what reads the dictionary.

import { memoByValue } from '@torahmap/utils';
import {
  effectiveMode as modeIn,
  languageOf,
  modesOffered as modesIn,
  type ExtraMode,
  type MatchMode,
  type SearchLanguage,
  type SearchTerm,
  type TextRange,
} from '@torahmap/search';
import { onlySeparators, splitIntoWords, stripNikkud } from '@torahmap/hebrew';
import {
  meaningsFor,
  sameMeaning,
  wordMatches,
  type Meaning,
  type Parse,
  type VerseWords,
} from './dictionary.ts';
import type { Dictionary } from './search.ts';
import { TANAKH_LANGUAGES } from './languages.ts';
import { ENGLISH, HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';

/**
 * How a term is matched. Meanings resolves a written form to the dictionary words
 * it could be, so it is offered only where there is a dictionary — Hebrew.
 */
export type SearchMode = MatchMode | 'meanings';

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

/** Each term's own language, decided by its own text. */
export function termIsHebrew(term: SearchTerm): boolean {
  return languageOf(TANAKH_LANGUAGES, term).id === HEBREW;
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

/** Meanings, offered to a Hebrew term and its default there. */
/**
 * What meanings mode works from: the dictionary, and the per-word parse that
 * says which reading each word of a verse is, once it is in.
 */
export interface MeaningsData {
  readonly dictionary: Dictionary;
  readonly parse: Parse | null;
}

// Per dictionary, then per parse: the same files give the same object.
const pairs = memoByValue((dictionary: Dictionary) => {
  const alone: MeaningsData = { dictionary, parse: null };
  const withParse = memoByValue((parse: Parse): MeaningsData => ({ dictionary, parse }));
  return (parse: Parse | null) => (parse ? withParse(parse) : alone);
});

export function meaningsData(dictionary: Dictionary, parse: Parse | null = null): MeaningsData {
  return pairs(dictionary)(parse);
}

export const meaningsMode: ExtraMode<MeaningsData> = {
  id: 'meanings',
  letter: 'm',
  label: 'meanings',
  unavailable: "Meanings mode isn't available for phrases",
  offered: (_term, language) => language.id === HEBREW,
  possible: (x, term) => meaningsPossible(x?.dictionary ?? null, term),
  isDefault: (_term, language) => language.id === HEBREW,
};

/** What the reader chose, or the default for the language the text is in. */
export function effectiveMode(dictionary: Dictionary | null, term: SearchTerm): SearchMode {
  const x = dictionary ? meaningsData(dictionary) : null;
  return modeIn(term, TANAKH_LANGUAGES, meaningsMode, x) as SearchMode;
}

/** The modes this term's own text can be matched by, in the order shown. */
export function modesOffered(term: SearchTerm): SearchMode[] {
  return modesIn(term, TANAKH_LANGUAGES, meaningsMode) as SearchMode[];
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

/**
 * The words of a verse's `text` that are one of the meanings the term still
 * stands for, in the text's own positions.
 *
 * By position rather than by spelling, which is what separates the two words
 * spelled עלה in Genesis 8:20 — a spelling could be either, and only the place
 * in the verse says which this one is. A meaning is Hebrew, so it marks nothing
 * in English.
 */
export function meaningRanges(
  dictionary: Dictionary,
  words: VerseWords | null,
  term: SearchTerm,
  text: string,
  language: SearchLanguage,
): TextRange[] {
  const keys = selectedKeys(dictionary, term);
  if (language.id !== HEBREW || keys.length === 0) return [];
  const folded = language.fold(text);
  const ranges: TextRange[] = [];
  for (const { word, start, end } of splitIntoWords(folded)) {
    if (wordMatches(dictionary, words, keys, word, text, start)) {
      ranges.push({ start: language.toOriginal(text, start), end: language.toOriginal(text, end) });
    }
  }
  return ranges;
}

/**
 * The stretch a result row quotes around: the first match, joined to as many
 * after it as the term has further words. Meanings mode marks word by word, so
 * a phrase it finds, בית אל, is joined into one mark; a word repeated, קדוש
 * קדוש קדוש, is not. A word's points lie after its mark, so they do not part it
 * from the next.
 */
export function quotedMeaning(term: SearchTerm, text: string, ranges: TextRange[]): TextRange {
  const [first, ...rest] = ranges;
  let end = first.end;
  for (const next of rest.slice(0, splitIntoWords(term.text).length - 1)) {
    const between = stripNikkud(text.slice(end, next.start));
    if (!onlySeparators(between, 0, between.length)) break;
    end = next.end;
  }
  return { start: first.start, end };
}
