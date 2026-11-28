/**
 * Sefaria's word-form table and Jastrow's entries, read from Sefaria's database dump
 * (DATA_REGENERATION.md, "Talmud word forms"), and the Talmud's words as search.json holds them.
 *
 * Each record of the table maps one written form to headwords, says how it was
 * made (`generated_by`) and may list passages. What the passages mean depends
 * on how the record was made:
 * - `prefix_adder_1`: every segment of the Bavli the form occurs in;
 * - `jastrow_jackpot`: the passages Jastrow quotes the form from, under that headword;
 * - `adjust_most_common_talmud_words`: no passages; Sefaria's own choice of
 *   headword for a few hundred common Talmud words.
 *
 * The vowels come from the text the map shows, which lines up word for word with search.json.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalizeHebrewForSearch } from '@torahmap/hebrew';
import { documents } from './bson.ts';

export const DEFAULT_DUMP = join(homedir(), 'data/torahmap/talmud/raw/sefaria-dump/dump/sefaria');
export const JASTROW = 'Jastrow Dictionary';
/** The letters the Talmud's whole-word search lets a word carry in front. */
export const PREFIXES = new Set('דולבכשמה');
export const MAX_PREFIX = 3;

export const OCCURS = 'prefix_adder_1';
export const QUOTED = 'jastrow_jackpot';
export const CHOSEN = 'adjust_most_common_talmud_words';

// ---------------------------------------------------------------------------
// Passages. The text is search.json's segments, each named as Sefaria names
// it ("Berakhot 2a:3"); a passage is that segment, or its amud ("Berakhot 2a").

export interface Amud {
  daf: number;
  amud: string;
}
export interface Structure {
  tractates: { name: string; amudim: Amud[] }[];
}

export const amudName = (tractate: string, a: Amud) => `${tractate} ${a.daf}${a.amud}`;

/** The segments and amudim a Sefaria ref names; a range across amudim names its two ends'. */
export function passagesOf(ref: string): string[] {
  const m = /^(.+?) (\d+[ab])(?::(\d+))?(?:-(?:(\d+[ab]):)?(\d+))?$/.exec(ref);
  if (!m) return [];
  const [, book, amud, from, toAmud, to] = m;
  const out = [`${book} ${amud}`];
  if (toAmud) out.push(`${book} ${toAmud}`, `${book} ${amud}:${from}`, `${book} ${toAmud}:${to}`);
  else if (from) {
    for (let s = Number(from); s <= Number(to ?? from); s++) out.push(`${book} ${amud}:${s}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The word-form table, folded to the spelling search compares in.

export const fold = (s: string) => normalizeHebrewForSearch(s).trim();

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
/**
 * Letters and vowels, to compare the text's vowels with Jastrow's: no cantillation, meteg or
 * dagesh (a prefix adds or takes away a dagesh), final letters folded, qamats qatan as qamats.
 */
export const pointedFold = (s: string) =>
  [...s.normalize('NFD')]
    .map(
      (c) =>
        FINALS[c] ?? ({ '\u05C7': '\u05B8', '\u05BA': '\u05B9' } as Record<string, string>)[c] ?? c,
    )
    .filter((c) => /[\u05D0-\u05EA\u05B0-\u05BB\u05C1\u05C2]/.test(c))
    .join('');
export const isPointed = (s: string) => /[\u05B0-\u05BB]/.test(s);

export interface Headword {
  /** How the records linking it to this form were made. */
  sources: Set<string>;
  /** Segments the form occurs in, by the occurrence lists. */
  occurs: Set<string>;
  /** Passages Jastrow quotes the form from under this headword. */
  quoted: Set<string>;
}
export type FormEntry = Map<string, Headword>;

export function loadForms(dump: string) {
  const forms = new Map<string, FormEntry>();
  const bySource = new Map<string, { records: number; pointed: number }>();
  /** Each headword's spellings with vowels. */
  const pointed = new Map<string, Set<string>>();
  for (const doc of documents(join(dump, 'word_form.bson'))) {
    const lookups = (doc.lookups ?? []) as { headword?: string; parent_lexicon?: string }[];
    const jastrow = lookups.filter((l) => l.parent_lexicon === JASTROW && l.headword);
    if (jastrow.length === 0) continue;
    const source = String(doc.generated_by ?? 'not stated');
    const s = bySource.get(source) ?? { records: 0, pointed: 0 };
    s.records++;
    if (/[ְ-ׇ]/.test(String(doc.form))) s.pointed++;
    bySource.set(source, s);

    if (isPointed(String(doc.form))) {
      for (const { headword } of jastrow) addTo(pointed, headword!, pointedFold(String(doc.form)));
    }

    const refs = ((doc.refs ?? []) as string[]).flatMap(passagesOf);
    const keys = new Set([doc.form, doc.c_form].filter((f): f is string => !!f).map(fold));
    for (const key of keys) {
      let entry = forms.get(key);
      if (!entry) forms.set(key, (entry = new Map()));
      for (const { headword } of jastrow) {
        let h = entry.get(headword!);
        if (!h)
          entry.set(headword!, (h = { sources: new Set(), occurs: new Set(), quoted: new Set() }));
        h.sources.add(source);
        const into = source === OCCURS ? h.occurs : h.quoted;
        for (const r of refs) into.add(r);
      }
    }
  }
  return { forms, bySource, pointed };
}

export interface Entry {
  /** Passages the entry cites. */
  cites: Set<string>;
  /** Jastrow's language note, read as Aramaic ("ch.", Chaldaic) or Hebrew ("h.", "b. h."). */
  language?: 'Aramaic' | 'Hebrew';
}

export function languageOf(note: unknown): Entry['language'] {
  if (typeof note !== 'string') return undefined;
  if (/\bch\b|arc/.test(note)) return 'Aramaic';
  if (/\bh\.|heb|BH|PBH|NH|MH/.test(note)) return 'Hebrew';
  return undefined;
}

export function addTo(m: Map<string, Set<string>>, key: string, value: string) {
  m.set(key, (m.get(key) ?? new Set()).add(value));
}

/** Adds each entry's headword and other headwords to `pointed`. */
export function loadEntries(dump: string, pointed: Map<string, Set<string>>): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const doc of documents(join(dump, 'lexicon_entry.bson'))) {
    if (doc.parent_lexicon !== JASTROW) continue;
    for (const w of [doc.headword, ...((doc.alt_headwords ?? []) as string[])]) {
      if (typeof w === 'string' && isPointed(w))
        addTo(pointed, doc.headword as string, pointedFold(w));
    }
    entries.set(doc.headword as string, {
      cites: new Set(((doc.refs ?? []) as string[]).flatMap(passagesOf)),
      language: languageOf(doc.language_code),
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// The text's words: runs of letters, keeping an abbreviation's ׳ and the ״
// inside one (רשב״ג). A ״ at a word's end closes a quotation.

export const WORD = /[א-ת]+(?:״[א-ת]+)*׳?/g;

export interface Token {
  form: string;
  written: string;
  segment: string;
  amud: string;
  /** The word with the vowels the map shows, when the segment's words line up with search's. */
  pointed?: string;
}

/** A word with its points; the maqaf (U+05BE) and sof pasuq (U+05C3) end it. */
export const POINTED_WORD = /[א-ת][א-ת֑-ֽֿ-ׂׄ-ׇ]*(?:״[א-ת֑-ֽֿ-ׂׄ-ׇ]+)*׳?/g;

export function* tokens(): Generator<Token> {
  const structure: Structure = JSON.parse(
    readFileSync('public/data/talmud/structure.json', 'utf8'),
  );
  const text: Record<string, string[][]> = JSON.parse(
    readFileSync('public/data/talmud/search.json', 'utf8'),
  );
  for (const { name, amudim } of structure.tractates) {
    const shown: string[][] = JSON.parse(
      readFileSync(`public/data/talmud/texts/${name}.json`, 'utf8'),
    ).amudim;
    for (const [i, a] of amudim.entries()) {
      const amud = amudName(name, a);
      for (const [s, segment] of text[name][i].entries()) {
        const words = [...segment.matchAll(WORD)].map(([w]) => w);
        const pointed = [...(shown[i]?.[s] ?? '').matchAll(POINTED_WORD)].map(([w]) => w);
        const aligned =
          pointed.length === words.length && pointed.every((p, k) => fold(p) === fold(words[k]));
        for (const [k, word] of words.entries()) {
          yield {
            form: fold(word),
            written: word,
            segment: `${amud}:${s + 1}`,
            amud,
            pointed: aligned ? pointed[k] : undefined,
          };
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

/** The form as written, then with one, two, three prefix letters taken off, keeping two letters. */
export function readings(form: string): string[] {
  const out = [form];
  for (let n = 1; n <= MAX_PREFIX && form.length - n >= 2; n++) {
    if (!PREFIXES.has(form[n - 1])) break;
    out.push(form.slice(n));
  }
  return out;
}

/**
 * Forms one ו or י away, added or removed inside a word of four letters or
 * more: full and defective spellings, as אומר and אמר. Kept off the first and
 * last letters, where a ו or י is usually a prefix or a suffix (לה, ליה).
 */
export function spellingVariants(form: string): string[] {
  if (form.length < 4) return [];
  const out: string[] = [];
  for (let i = 1; i < form.length - 1; i++) {
    if (form[i] === 'ו' || form[i] === 'י') out.push(form.slice(0, i) + form.slice(i + 1));
    for (const v of 'וי') out.push(form.slice(0, i) + v + form.slice(i));
  }
  return out;
}

/** The headwords the form reaches other than through the occurrence lists alone, which also take off prefixes (מאי as מ + אי). */
export function direct(entry: FormEntry): string[] {
  const out = [...entry]
    .filter(([, h]) => [...h.sources].some((s) => s !== OCCURS))
    .map(([w]) => w);
  return out.length ? out : [...entry.keys()];
}

/** Prefix letters as `pointedFold` leaves them: the letter and its vowel. */
export const POINTED_PREFIX = /^[דולבכשמה][\u05B0-\u05BB]?/;

/**
 * The headwords whose spellings carry the word's vowels: as shown, else with up to three
 * prefix letters taken off, each with its vowel.
 */
export function vowelMatches(heads: string[], word: string, pointed: Map<string, Set<string>>) {
  let form = word;
  for (let n = 0; n <= MAX_PREFIX; n++) {
    const found = heads.filter((w) => pointed.get(w)?.has(form));
    if (found.length) return Object.assign(found, { stripped: n > 0 });
    const next = form.replace(POINTED_PREFIX, '');
    if (next === form || normalizeHebrewForSearch(next).length < 2) break;
    form = next;
  }
  return Object.assign([] as string[], { stripped: false });
}
