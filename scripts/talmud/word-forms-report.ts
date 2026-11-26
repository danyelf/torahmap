#!/usr/bin/env tsx
/**
 * How much of the Talmud Sefaria's word-form table can look up in Jastrow, and
 * against the text search reads, search.json. A report, not a test: it prints
 * numbers and lists, and checks nothing.
 *
 * Usage:
 *   npx tsx scripts/talmud/word-forms-report.ts [folder holding the two files]
 */

import { gzipSync } from 'node:zlib';
import {
  CHOSEN,
  MAX_PREFIX,
  DEFAULT_DUMP,
  type FormEntry,
  direct,
  loadEntries,
  loadForms,
  pointedFold,
  readings,
  spellingVariants,
  tokens,
  vowelMatches,
} from './word-forms.ts';

const DUMP = process.argv[2] ?? DEFAULT_DUMP;

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
  const { forms, bySource, pointed } = loadForms(DUMP);
  const entries = loadEntries(DUMP, pointed);
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
    vowelsShown: 0,
    vowelsOne: 0,
    vowelsOneStripped: 0,
    vowelsSeveral: 0,
    vowelsNone: 0,
    vowelsOnlyWay: 0,
    vowelsWithPick: 0,
    vowelsAgreePick: 0,
  };
  /** By form: tokens settled by vowels, under each headword, and tokens no headword's vowels match. */
  /** "form: as shown → headword" where the vowels and Sefaria's pick part, with tokens. */
  const disagree = new Map<string, number>();
  /** Vowelled forms the vowels alone bring down to one headword, and that headword. */
  const settledByVowels = new Map<string, string>();
  const vowelExamples = new Map<
    string,
    { written: string; under: Map<string, number>; none: Map<string, number> }
  >();
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
    const before = chosen || byOccurrence || bySegment || byAmud || byDirect;
    if (before) {
      t.resolved++;
      s.resolved++;
    }

    if (!tok.pointed) continue;
    t.vowelsShown++;
    const ex = vowelExamples.get(tok.form) ?? {
      written: tok.written,
      under: new Map(),
      none: new Map(),
    };
    vowelExamples.set(tok.form, ex);
    const matching = vowelMatches(
      heads.map(([w]) => w),
      pointedFold(tok.pointed),
      pointed,
    );
    if (matching.length === 0) {
      t.vowelsNone++;
      ex.none.set(tok.pointed, (ex.none.get(tok.pointed) ?? 0) + 1);
      continue;
    }
    if (matching.length > 1) {
      t.vowelsSeveral++;
      continue;
    }
    if (matching.stripped) t.vowelsOneStripped++;
    else t.vowelsOne++;
    ex.under.set(matching[0], (ex.under.get(matching[0]) ?? 0) + 1);
    if (!before) {
      t.vowelsOnlyWay++;
      settledByVowels.set(pointedFold(tok.pointed), matching[0]);
    }
    if (chosen) {
      t.vowelsWithPick++;
      if (heads.some(([w, h]) => w === matching[0] && h.sources.has(CHOSEN))) t.vowelsAgreePick++;
      else {
        const pick = heads.filter(([, h]) => h.sources.has(CHOSEN)).map(([w]) => w);
        const key = `${tok.written}: ${tok.pointed} → ${matching[0]}, picked ${pick.join(' · ')}`;
        disagree.set(key, (disagree.get(key) ?? 0) + 1);
      }
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

  console.log('\n## Vowels (share of covered tokens with several headwords)');
  console.log(
    `- the map shows the word with vowels, lined up with search's: ${pct(t.vowelsShown, t.ambiguous)}`,
  );
  console.log(`- one headword's spellings have the same vowels: ${pct(t.vowelsOne, t.ambiguous)}`);
  console.log(`- …after taking prefix letters off: ${pct(t.vowelsOneStripped, t.ambiguous)}`);
  console.log(`- several do: ${pct(t.vowelsSeveral, t.ambiguous)}`);
  console.log(`- none does: ${pct(t.vowelsNone, t.ambiguous)}`);
  console.log(`- settled by vowels and by nothing above: ${pct(t.vowelsOnlyWay, t.ambiguous)}`);
  console.log(
    `- where Sefaria also picked, the vowels pick the same headword: ${pct(t.vowelsAgreePick, t.vowelsWithPick)} of ${count(t.vowelsWithPick)}`,
  );
  console.log(
    `Covered tokens that come down to one headword, adding vowels: ${pct(t.resolved + t.vowelsOnlyWay, covered)}`,
  );
  const byTokens = [...vowelExamples].map(([, e]) => e);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const commonest = (m: Map<string, number>, n: number) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w, c]) => `${w} ${count(c)}`)
      .join(' · ');
  console.log('\nThe forms vowels settle most often (form: headword tokens · …):');
  for (const e of byTokens.sort((a, b) => sum(b.under) - sum(a.under)).slice(0, 30)) {
    console.log(`- ${e.written}: ${commonest(e.under, 4)}`);
  }
  console.log(
    "\nWhere the vowels and Sefaria's pick part, commonest first (form: as shown → vowels' headword, Sefaria's pick; tokens):",
  );
  for (const [k, n] of [...disagree].sort((a, b) => b[1] - a[1]).slice(0, 30))
    console.log(`- ${k} ${count(n)}`);
  console.log(
    '\nThe forms whose vowels match none of their headwords most often (form: as shown tokens · …):',
  );
  for (const e of byTokens.sort((a, b) => sum(b.none) - sum(a.none)).slice(0, 30)) {
    console.log(`- ${e.written} ${count(sum(e.none))}: ${commonest(e.none, 3)}`);
  }

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

  const ids = new Map<string, number>();
  const overrides = JSON.stringify(
    Object.fromEntries(
      [...settledByVowels].map(([f, w]) => [f, ids.get(w) ?? (ids.set(w, ids.size), ids.size - 1)]),
    ),
  );
  console.log(
    `Vowelled forms the vowels alone settle, each to a headword number: ${count(settledByVowels.size)} forms, ${count(gzipSync(overrides).length)} bytes gzipped`,
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
