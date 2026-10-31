#!/usr/bin/env tsx
/**
 * How much of the Talmud Sefaria's word-form table can look up in Jastrow, and
 * how often it can say which of a form's Jastrow headwords is meant. Measured
 * against the text search reads, search.json. A report, not a test: it prints
 * numbers and lists, and checks nothing.
 *
 * Each record of the table maps one written form to headwords, says how it was
 * made (`generated_by`) and may list passages. What the passages mean depends
 * on how the record was made:
 * - `prefix_adder_1`: every segment of the Bavli the form occurs in;
 * - `jastrow_jackpot`: the passages Jastrow quotes the form from, under that headword;
 * - `adjust_most_common_talmud_words`: no passages; Sefaria's own choice of
 *   headword for a few hundred common Talmud words.
 *
 * Needs `word_form.bson` and `lexicon_entry.bson` from Sefaria's database dump
 * (DATA_REGENERATION.md, "Talmud word forms").
 *
 * Usage:
 *   npx tsx scripts/talmud/word-forms-report.ts [folder holding the two files]
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { normalizeHebrewForSearch } from '@torahmap/hebrew';
import { documents } from './bson.ts';

const DUMP =
  process.argv[2] ?? join(homedir(), 'data/torahmap/talmud/raw/sefaria-dump/dump/sefaria');
const JASTROW = 'Jastrow Dictionary';
/** The letters the Talmud's whole-word search lets a word carry in front. */
const PREFIXES = new Set('דולבכשמה');
const MAX_PREFIX = 3;

const OCCURS = 'prefix_adder_1';
const QUOTED = 'jastrow_jackpot';
const CHOSEN = 'adjust_most_common_talmud_words';

// ---------------------------------------------------------------------------
// Passages. The text is search.json's segments, each named as Sefaria names
// it ("Berakhot 2a:3"); a passage is that segment, or its amud ("Berakhot 2a").

interface Amud {
  daf: number;
  amud: string;
}
interface Structure {
  tractates: { name: string; amudim: Amud[] }[];
}

const amudName = (tractate: string, a: Amud) => `${tractate} ${a.daf}${a.amud}`;

/** The segments and amudim a Sefaria ref names; a range across amudim names its two ends'. */
function passagesOf(ref: string): string[] {
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

const fold = (s: string) => normalizeHebrewForSearch(s).trim();

interface Headword {
  /** How the records linking it to this form were made. */
  sources: Set<string>;
  /** Segments the form occurs in, by the occurrence lists. */
  occurs: Set<string>;
  /** Passages Jastrow quotes the form from under this headword. */
  quoted: Set<string>;
}
type FormEntry = Map<string, Headword>;

function loadForms() {
  const forms = new Map<string, FormEntry>();
  const bySource = new Map<string, { records: number; pointed: number }>();
  for (const doc of documents(join(DUMP, 'word_form.bson'))) {
    const lookups = (doc.lookups ?? []) as { headword?: string; parent_lexicon?: string }[];
    const jastrow = lookups.filter((l) => l.parent_lexicon === JASTROW && l.headword);
    if (jastrow.length === 0) continue;
    const source = String(doc.generated_by ?? 'not stated');
    const s = bySource.get(source) ?? { records: 0, pointed: 0 };
    s.records++;
    if (/[ְ-ׇ]/.test(String(doc.form))) s.pointed++;
    bySource.set(source, s);

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
  return { forms, bySource };
}

interface Entry {
  /** Passages the entry cites. */
  cites: Set<string>;
  /** Jastrow's language note, read as Aramaic ("ch.", Chaldaic) or Hebrew ("h.", "b. h."). */
  language?: 'Aramaic' | 'Hebrew';
}

function languageOf(note: unknown): Entry['language'] {
  if (typeof note !== 'string') return undefined;
  if (/\bch\b|arc/.test(note)) return 'Aramaic';
  if (/\bh\.|heb|BH|PBH|NH|MH/.test(note)) return 'Hebrew';
  return undefined;
}

function loadEntries(): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const doc of documents(join(DUMP, 'lexicon_entry.bson'))) {
    if (doc.parent_lexicon !== JASTROW) continue;
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

const WORD = /[א-ת]+(?:״[א-ת]+)*׳?/g;

interface Token {
  form: string;
  written: string;
  segment: string;
  amud: string;
}

function* tokens(): Generator<Token> {
  const structure: Structure = JSON.parse(
    readFileSync('public/data/talmud/structure.json', 'utf8'),
  );
  const text: Record<string, string[][]> = JSON.parse(
    readFileSync('public/data/talmud/search.json', 'utf8'),
  );
  for (const { name, amudim } of structure.tractates) {
    for (const [i, a] of amudim.entries()) {
      const amud = amudName(name, a);
      for (const [s, segment] of text[name][i].entries()) {
        for (const [word] of segment.matchAll(WORD)) {
          yield { form: fold(word), written: word, segment: `${amud}:${s + 1}`, amud };
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

/** The form as written, then with one, two, three prefix letters taken off, keeping two letters. */
function readings(form: string): string[] {
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
function spellingVariants(form: string): string[] {
  if (form.length < 4) return [];
  const out: string[] = [];
  for (let i = 1; i < form.length - 1; i++) {
    if (form[i] === 'ו' || form[i] === 'י') out.push(form.slice(0, i) + form.slice(i + 1));
    for (const v of 'וי') out.push(form.slice(0, i) + v + form.slice(i));
  }
  return out;
}

/** The headwords the form reaches other than through the occurrence lists alone, which also take off prefixes (מאי as מ + אי). */
function direct(entry: FormEntry): string[] {
  const out = [...entry]
    .filter(([, h]) => [...h.sources].some((s) => s !== OCCURS))
    .map(([w]) => w);
  return out.length ? out : [...entry.keys()];
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');
const count = (n: number) => n.toLocaleString('en-US');

interface Seen {
  tokens: number;
  written: string;
  entry?: FormEntry;
  /** Prefix letters taken off to find it; 0 when found as written. */
  strip: number;
  /** Tokens of it that come down to one headword. */
  resolved: number;
}

function main() {
  const { forms, bySource } = loadForms();
  const entries = loadEntries();
  const records = [...bySource.values()].reduce((a, s) => a + s.records, 0);
  console.log(`Word-form records with a Jastrow headword: ${count(records)}`);
  console.log(
    `Distinct forms, folded: ${count(forms.size)}; Jastrow entries: ${count(entries.size)}`,
  );
  console.log('By how they were made (records, share whose form carries vowel points):');
  for (const [s, n] of [...bySource].sort((a, b) => b[1].records - a[1].records)) {
    console.log(`- ${s}: ${count(n.records)}, ${pct(n.pointed, n.records)}`);
  }

  const seen = new Map<string, Seen>();
  let singleLetters = 0;
  let total = 0;
  const t = {
    byStrip: [0, 0, 0, 0],
    occursHere: 0,
    quotedSegment: 0,
    quotedAmud: 0,
    ambiguous: 0,
    chosen: 0,
    byOccurrence: 0,
    byQuoteSegment: 0,
    byQuoteAmud: 0,
    byDirect: 0,
    resolved: 0,
    languageAll: 0,
    languageAny: 0,
    languageOne: 0,
    languageUnmarkedHebrew: 0,
  };
  const counts = { all: new Map<number, number>(), direct: new Map<number, number>() };
  const bump = (m: Map<number, number>, n: number) => m.set(n, (m.get(n) ?? 0) + 1);

  for (const tok of tokens()) {
    if (tok.form.replace(/[׳״]/g, '').length < 2) {
      singleLetters++;
      continue;
    }
    total++;
    let s = seen.get(tok.form);
    if (!s) {
      const strip = readings(tok.form).findIndex((r) => forms.has(r));
      s = { tokens: 0, written: tok.written, strip, resolved: 0 };
      if (strip !== -1) s.entry = forms.get(readings(tok.form)[strip]);
      seen.set(tok.form, s);
    }
    s.tokens++;
    const entry = s.entry;
    if (!entry) continue;
    t.byStrip[s.strip]++;

    const heads = [...entry];
    const directHeads = direct(entry);
    bump(counts.all, heads.length);
    bump(counts.direct, directHeads.length);
    const occurring = heads.filter(([, h]) => h.occurs.has(tok.segment));
    const quote = (p: string) =>
      heads.filter(([w, h]) => h.quoted.has(p) || entries.get(w)?.cites.has(p));
    const quotedSegment = quote(tok.segment);
    const quotedAmud = quote(tok.amud);
    if (occurring.length) t.occursHere++;
    if (quotedSegment.length) t.quotedSegment++;
    if (quotedAmud.length) t.quotedAmud++;

    const languages = heads.map(([w]) => entries.get(w)?.language);
    if (languages.every(Boolean)) t.languageAll++;
    if (languages.some(Boolean)) t.languageAny++;
    if (new Set(languages.filter(Boolean)).size === 1 && languages.every(Boolean)) t.languageOne++;
    if (new Set(languages.map((l) => l ?? 'Hebrew')).size === 1) t.languageUnmarkedHebrew++;

    if (heads.length === 1) {
      t.resolved++;
      s.resolved++;
      continue;
    }
    t.ambiguous++;
    const chosen = heads.some(([, h]) => h.sources.has(CHOSEN));
    const byOccurrence = occurring.length === 1;
    const bySegment = quotedSegment.length === 1;
    const byAmud = quotedAmud.length === 1;
    const byDirect = directHeads.length === 1;
    if (chosen) t.chosen++;
    if (byOccurrence) t.byOccurrence++;
    if (bySegment) t.byQuoteSegment++;
    if (byAmud) t.byQuoteAmud++;
    if (byDirect) t.byDirect++;
    if (chosen || byOccurrence || bySegment || byAmud || byDirect) {
      t.resolved++;
      s.resolved++;
    }
  }

  const all = [...seen.values()];
  const covered = t.byStrip.reduce((a, b) => a + b, 0);
  const formsAt = (strip: number) => all.filter((s) => s.entry && s.strip === strip).length;
  console.log('\n## Coverage');
  console.log(
    `Word tokens of two letters or more: ${count(total)}; distinct forms: ${count(all.length)}; single letters left out: ${count(singleLetters)}\n`,
  );
  console.log('| | tokens | distinct forms |');
  console.log('|---|---|---|');
  console.log(`| as written | ${pct(t.byStrip[0], total)} | ${pct(formsAt(0), all.length)} |`);
  for (let n = 1; n <= MAX_PREFIX; n++) {
    console.log(
      `| else ${n} prefix letter${n > 1 ? 's' : ''} taken off | ${pct(t.byStrip[n], total)} | ${pct(formsAt(n), all.length)} |`,
    );
  }
  const coveredForms = all.filter((s) => s.entry).length;
  console.log(`| in all | ${pct(covered, total)} | ${pct(coveredForms, all.length)} |`);

  console.log('\n## Passages (share of covered tokens)');
  console.log(`- an occurrence list names the segment: ${pct(t.occursHere, covered)}`);
  console.log(
    `- Jastrow quotes the form, or its entry cites, the segment: ${pct(t.quotedSegment, covered)}`,
  );
  console.log(`- …or the amud: ${pct(t.quotedAmud, covered)}`);

  console.log('\n## Ambiguity (share of covered tokens by number of headwords)');
  console.log('| headwords | all | not only through an occurrence list |');
  console.log('|---|---|---|');
  for (const n of [1, 2, 3, 4, 5]) {
    console.log(
      `| ${n} | ${pct(counts.all.get(n) ?? 0, covered)} | ${pct(counts.direct.get(n) ?? 0, covered)} |`,
    );
  }
  const over = (m: Map<number, number>) =>
    [...m].filter(([n]) => n > 5).reduce((a, [, c]) => a + c, 0);
  console.log(
    `| more | ${pct(over(counts.all), covered)} | ${pct(over(counts.direct), covered)} |`,
  );
  console.log(
    `\nOf the ${count(t.ambiguous)} covered tokens with several headwords, one is picked out by:`,
  );
  console.log(`- Sefaria's own choice for common words: ${pct(t.chosen, t.ambiguous)}`);
  console.log(
    `- only one headword's occurrence list naming the segment: ${pct(t.byOccurrence, t.ambiguous)}`,
  );
  console.log(
    `- Jastrow quoting it at the segment under one headword: ${pct(t.byQuoteSegment, t.ambiguous)}`,
  );
  console.log(`- …at the amud: ${pct(t.byQuoteAmud, t.ambiguous)}`);
  console.log(
    `- leaving out headwords reached only through an occurrence list: ${pct(t.byDirect, t.ambiguous)}`,
  );
  console.log(
    `Covered tokens that come down to one headword, by any of these: ${pct(t.resolved, covered)}`,
  );

  console.log('\n## Hebrew or Aramaic (share of covered tokens)');
  console.log(`- every headword's entry says which: ${pct(t.languageAll, covered)}`);
  console.log(`- some headword's entry says: ${pct(t.languageAny, covered)}`);
  console.log(`- every headword's entry says, and they agree: ${pct(t.languageOne, covered)}`);
  console.log(
    `- the headwords agree, reading an entry with no note as Hebrew: ${pct(t.languageUnmarkedHebrew, covered)}`,
  );

  console.log('\n## Size of a form-to-headword file (forms found as written)');
  const asWrittenForms = [...seen].filter(([, s]) => s.entry && s.strip === 0);
  const fileSize = (headwordsOf: (entry: FormEntry) => string[]) => {
    const ids = new Map<string, number>();
    const mapping: Record<string, number[]> = {};
    for (const [form, s] of asWrittenForms) {
      mapping[form] = headwordsOf(s.entry!).map(
        (w) => ids.get(w) ?? (ids.set(w, ids.size), ids.size - 1),
      );
    }
    const json = JSON.stringify({ headwords: [...ids.keys()], forms: mapping });
    return `${count(Buffer.byteLength(json))} bytes, ${count(gzipSync(json).length)} gzipped; ${count(ids.size)} headwords`;
  };
  const chosenOrDirect = (entry: FormEntry) => {
    const chosen = [...entry].filter(([, h]) => h.sources.has(CHOSEN)).map(([w]) => w);
    return chosen.length ? chosen : direct(entry);
  };
  console.log(
    `${count(asWrittenForms.length)} forms. Every headword of a form: ${fileSize((e) => [...e.keys()])}`,
  );
  console.log(
    `Sefaria's choice, else the headwords not reached only through an occurrence list: ${fileSize(chosenOrDirect)}`,
  );

  const misses = [...seen].filter(([, s]) => !s.entry).sort((a, b) => b[1].tokens - a[1].tokens);
  console.log('\n## Gaps');
  console.log(
    `Uncovered: ${count(total - covered)} tokens, ${count(misses.length)} distinct forms`,
  );
  const asWritten = [...seen.values()]
    .filter((s) => s.strip !== 0)
    .sort((a, b) => b.tokens - a.tokens);
  const handEntries = (goal: number, have: number, missing: Seen[]) => {
    let n = 0;
    while (have < goal * total && n < missing.length) have += missing[n++].tokens;
    return count(n);
  };
  console.log('Forms to add by hand to reach a share of tokens, commonest first:');
  console.log('| share | as written | with prefix letters taken off |');
  console.log('|---|---|---|');
  for (const goal of [0.85, 0.9, 0.95]) {
    console.log(
      `| ${goal * 100}% | ${handEntries(goal, t.byStrip[0], asWritten)} | ${handEntries(
        goal,
        covered,
        misses.map(([, s]) => s),
      )} |`,
    );
  }
  const kind = (form: string) => {
    if (/[׳״]/.test(form)) return 'abbreviation';
    if (readings(form).some((r) => spellingVariants(r).some((v) => forms.has(v))))
      return 'ו/י spelling';
    return 'other';
  };
  const kinds = new Map<string, number>();
  for (const [form, s] of misses) kinds.set(kind(form), (kinds.get(kind(form)) ?? 0) + s.tokens);
  console.log('Uncovered tokens by kind (a ו/י variant in the table is a guess, not a check):');
  for (const [k, n] of kinds) console.log(`- ${k}: ${pct(n, total - covered)}`);
  console.log('\nMost frequent uncovered forms (tokens, running share of all tokens, kind):');
  let running = covered;
  misses.slice(0, 100).forEach(([form, s], i) => {
    running += s.tokens;
    console.log(`${i + 1}. ${s.written} ${count(s.tokens)} ${pct(running, total)} ${kind(form)}`);
  });

  console.log('\n## The most frequent forms found only by taking letters off (tokens; as)');
  const stripped = [...seen]
    .filter(([, s]) => s.strip > 0)
    .sort((a, b) => b[1].tokens - a[1].tokens);
  for (const [, s] of stripped.slice(0, 40)) {
    console.log(`- ${s.written} ${count(s.tokens)}; ${s.written.slice(s.strip)}`);
  }

  console.log('\n## The most frequent covered forms');
  console.log("(tokens; headwords; Sefaria's choice; share of tokens that come down to one)");
  const top = [...seen].filter(([, s]) => s.entry).sort((a, b) => b[1].tokens - a[1].tokens);
  for (const [, s] of top.slice(0, 50)) {
    const heads = [...s.entry!];
    const chosen = heads.filter(([, h]) => h.sources.has(CHOSEN)).map(([w]) => w);
    const via = s.strip ? ` (as ${s.written.slice(s.strip)})` : '';
    console.log(
      `- ${s.written}${via} ${count(s.tokens)}; ${heads.length}: ${heads.map(([w]) => w).join(' · ')}; ${chosen.join(' · ') || '—'}; ${pct(s.resolved, s.tokens)}`,
    );
  }
}

main();
