#!/usr/bin/env tsx
/**
 * The pilot of Decision 10 in docs/plans/2026-10-20-talmud-word-search-design.md: a language
 * model choosing each word's Jastrow entry in context, in two versions on the same segments.
 *
 * - With the word list: for each word Sefaria's list gives several headwords, the model
 *   chooses one of them, Sefaria's own pick marked.
 * - Without it: the model names each word's dictionary form and a gloss; the script looks the
 *   form up among Jastrow's headwords, and where several share it the model chooses among them.
 *
 * Both are scored against the occurrences Jastrow quotes under one of the form's headwords.
 * The model's answers are written by hand-run agents into the folder, one file per batch.
 *
 * Usage, in order:
 *   npx tsx scripts/talmud/model-pilot.ts prepare <folder>   segments and the first batches
 *   npx tsx scripts/talmud/model-pilot.ts lookup <folder>    the second batches, without the list
 *   npx tsx scripts/talmud/model-pilot.ts score <folder>
 *
 * `prepare-whole <folder> [phrase]` draws from every segment instead, for reading; `read` then lays out each
 * word's answers and a sheet of words drawn at random to judge by hand.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { documents } from './bson.ts';
import {
  CHOSEN,
  DEFAULT_DUMP,
  type FormEntry,
  JASTROW,
  fold,
  isPointed,
  loadEntries,
  loadForms,
  pointedFold,
  readings,
  tokens,
  vowelMatches,
} from './word-forms.ts';

const SEGMENTS = 200;
const WHOLE_SEGMENTS = 40;
const PER_BATCH = 20;
const SEED = 411;
const GLOSS_WORDS = 14;

interface Word {
  n: number;
  pointed: string;
  /** The form's headwords in Sefaria's list, and Sefaria's pick among them. */
  heads: string[];
  pick: string[];
  /** The headword Jastrow quotes this segment under, when exactly one of the form's. */
  truth?: string;
}
interface Segment {
  id: string;
  before: string;
  after: string;
  words: Word[];
}

// ---------------------------------------------------------------------------
// Jastrow's entries: a short gloss each, and the spellings a named form is looked up by.

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function definitions(senses: unknown): string[] {
  return ((senses ?? []) as { definition?: string; senses?: unknown }[]).flatMap((s) => [
    ...(s.definition ? [s.definition] : []),
    ...definitions(s.senses),
  ]);
}

/** Grammar notes Jastrow sets in italics with the English: "Part. pass.", "Pi.", "f.". */
const GRAMMAR = /^(?:[A-Za-z]{1,6}\.\s*)+$/;

/** Jastrow's English, which he sets in italics, from the first senses. */
function english(senses: unknown): string {
  const words: string[] = [];
  for (const d of definitions(senses)) {
    for (const [, i] of d.matchAll(/<i>(.*?)<\/i>/g)) {
      const text = stripHtml(i);
      if (text && !GRAMMAR.test(text)) words.push(...text.split(' '));
    }
    if (words.length >= GLOSS_WORDS) break;
  }
  return words.slice(0, GLOSS_WORDS).join(' ');
}

/** The entry an Aramaic or Hebrew entry is "same" as, from Jastrow's language note. */
const sameAs = (note: unknown) =>
  typeof note === 'string' ? /data-ref="Jastrow, (.+?) \d+"/.exec(note)?.[1] : undefined;

/** A headword without Jastrow's numbering ("אָמַר I", "שַׁל ²") or its mark for a doubtful form. */
const bareHeadword = (w: string) => w.replace(/[*]/g, '').replace(/\s+[IVX¹²³⁴⁵⁶⁷⁸⁹]+$/u, '');

function loadJastrow(dump: string) {
  const gloss = new Map<string, string>();
  const raw = new Map<string, { own: string; language: string; same?: string }>();
  const byPointed = new Map<string, Set<string>>();
  const byLetters = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, w: string) =>
    m.set(k, (m.get(k) ?? new Set()).add(w));
  for (const doc of documents(join(dump, 'lexicon_entry.bson'))) {
    if (doc.parent_lexicon !== JASTROW) continue;
    const w = doc.headword as string;
    const own = english((doc.content as { senses?: unknown } | undefined)?.senses);
    raw.set(w, {
      own,
      language: String(doc.language_code ?? '').trim(),
      same: sameAs(doc.language_reference),
    });
    for (const s of [w, ...((doc.alt_headwords ?? []) as string[])]) {
      if (typeof s !== 'string') continue;
      const bare = bareHeadword(s);
      if (isPointed(bare)) add(byPointed, pointedFold(bare), w);
      add(byLetters, fold(bare), w);
    }
  }
  for (const [w, r] of raw) {
    const same =
      r.same && `same as ${r.same}${raw.get(r.same)?.own ? ` (${raw.get(r.same)!.own})` : ''}`;
    gloss.set(w, [r.language && `[${r.language}]`, same, r.own].filter(Boolean).join(' '));
  }
  return { gloss, byPointed, byLetters };
}

/** The headwords a named dictionary form can be: by its vowels, else by its letters. */
function lookUp(form: string, j: ReturnType<typeof loadJastrow>): string[] {
  const byVowels = j.byPointed.get(pointedFold(form));
  if (byVowels?.size) return [...byVowels];
  return [...(j.byLetters.get(fold(form)) ?? [])];
}

// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function headsOf(form: string, forms: Map<string, FormEntry>) {
  for (const r of readings(form)) {
    const entry = forms.get(r);
    if (entry) return entry;
  }
  return undefined;
}

/**
 * Draws the segments: from those holding an occurrence Jastrow quotes (the test), or, with
 * `whole`, from every segment of the Talmud alike, to show what a reader would meet. A
 * `phrase`, written without vowels, keeps only the segments holding it.
 */
function prepare(folder: string, whole: boolean, phrase?: string) {
  const { forms } = loadForms(DEFAULT_DUMP);
  const entries = loadEntries(DEFAULT_DUMP, new Map());
  const order: { id: string; text: string[]; words: Word[] }[] = [];
  for (const tok of tokens()) {
    let seg = order.at(-1);
    if (seg?.id !== tok.segment) order.push((seg = { id: tok.segment, text: [], words: [] }));
    seg.text.push(tok.pointed ?? tok.written);
    if (!tok.pointed || tok.form.replace(/[׳״]/g, '').length < 2) continue;
    const entry = headsOf(tok.form, forms);
    const heads = entry ? [...entry] : [];
    const quoted = heads.filter(
      ([w, h]) => h.quoted.has(tok.segment) || entries.get(w)?.cites.has(tok.segment),
    );
    seg.words.push({
      n: seg.words.length + 1,
      pointed: tok.pointed,
      heads: heads.map(([w]) => w),
      pick: heads.filter(([, h]) => h.sources.has(CHOSEN)).map(([w]) => w),
      truth: quoted.length === 1 ? quoted[0][0] : undefined,
    });
  }
  const eligible = order
    .map((s, i) => ({ s, i }))
    .filter(({ s }) =>
      whole
        ? s.words.length > 0 && (!phrase || fold(s.text.join(' ')).includes(fold(phrase)))
        : s.words.some((w) => w.truth && w.heads.length > 1),
    );
  const random = mulberry32(SEED);
  for (let i = eligible.length - 1; i > 0; i--) {
    const k = Math.floor(random() * (i + 1));
    [eligible[i], eligible[k]] = [eligible[k], eligible[i]];
  }
  const chosen = eligible.slice(0, whole ? WHOLE_SEGMENTS : SEGMENTS).sort((a, b) => a.i - b.i);
  const segments: Segment[] = chosen.map(({ s, i }) => ({
    id: s.id,
    before: order[i - 1]?.text.join(' ') ?? '',
    after: order[i + 1]?.text.join(' ') ?? '',
    words: s.words,
  }));
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'segments.json'), JSON.stringify(segments, null, 1));
  console.log(`${eligible.length} segments to draw from; ${segments.length} taken.`);

  const { gloss } = loadJastrow(DEFAULT_DUMP);
  for (let b = 0; b * PER_BATCH < segments.length; b++) {
    const batch = segments.slice(b * PER_BATCH, (b + 1) * PER_BATCH);
    const name = String(b + 1).padStart(2, '0');
    writeFileSync(join(folder, `with-list-${name}.md`), withListBatch(batch, gloss));
    writeFileSync(join(folder, `without-list-${name}.md`), withoutListBatch(batch));
  }
}

const context = (s: Segment) =>
  [
    `### ${s.id}`,
    s.before && `Before (context only): ${s.before}`,
    `Text: ${s.words.map((w) => w.pointed).join(' ')}`,
    s.after && `After (context only): ${s.after}`,
  ]
    .filter(Boolean)
    .join('\n');

function withListBatch(batch: Segment[], gloss: Map<string, string>) {
  const out = [
    'You are reading passages of the Babylonian Talmud (Hebrew and Aramaic, vowelled).',
    "For each numbered word below, choose which of the listed entries of Jastrow's dictionary",
    'the word is an instance of, here, in this passage. "Sefaria\'s pick" marks the entry',
    "Sefaria's editors chose for that spelling in general; it is a hint, not always right here.",
    'Answer 0 if none of the entries fits.',
    '',
    'Answer as one JSON object: segment name → word number → entry number, for example',
    '{"Berakhot 2a:1": {"3": 2, "7": 1}}. Answer every word listed.',
    '',
  ];
  for (const s of batch) {
    out.push(context(s), '');
    for (const w of s.words.filter((w) => w.heads.length > 1)) {
      out.push(`Word ${w.n}: ${w.pointed}`);
      w.heads.forEach((h, k) =>
        out.push(
          `  ${k + 1}. ${h}${w.pick.includes(h) ? " (Sefaria's pick)" : ''}: ${gloss.get(h) ?? ''}`,
        ),
      );
    }
    out.push('');
  }
  return out.join('\n');
}

function withoutListBatch(batch: Segment[]) {
  const out = [
    'You are reading passages of the Babylonian Talmud (Hebrew and Aramaic, vowelled).',
    "For each word of each Text line, give the form it would be listed under in Jastrow's",
    'dictionary, with vowels, and a short English gloss of its sense here. Leave off prefixed',
    'letters (ו ד ה ב כ ל מ ש) that are not part of the word, and suffixed pronouns. Verbs go',
    'under their root form as Jastrow lists them (אוֹמֵר → אָמַר, תְּנַן → תְּנֵי); names under the name.',
    'Words are numbered from 1 in the order of the Text line, counting only words of two',
    'letters or more.',
    '',
    'Answer as one JSON object: segment name → word number → [dictionary form, gloss], for',
    'example {"Berakhot 2a:1": {"1": ["מֵאֵימָתַי", "from when"], "2": ["קָרָא", "to read"]}}.',
    'Answer every word.',
    '',
  ];
  for (const s of batch) {
    out.push(context(s), `Words: ${s.words.map((w) => `${w.n} ${w.pointed}`).join(' · ')}`, '');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------

type Answers<T> = Record<string, Record<string, T>>;

function readAnswers<T>(folder: string, prefix: string): Answers<T> {
  const out: Answers<T> = {};
  for (const f of readdirSync(folder).filter((f) => f.startsWith(prefix) && f.endsWith('.json'))) {
    Object.assign(out, JSON.parse(readFileSync(join(folder, f), 'utf8')));
  }
  return out;
}

const segmentsOf = (folder: string): Segment[] =>
  JSON.parse(readFileSync(join(folder, 'segments.json'), 'utf8'));

function lookup(folder: string) {
  const j = loadJastrow(DEFAULT_DUMP);
  const named = readAnswers<[string, string]>(folder, 'without-list-');
  const items: string[] = [];
  const segments = segmentsOf(folder);
  for (const s of segments) {
    for (const w of s.words) {
      const answer = named[s.id]?.[w.n];
      if (!answer) continue;
      const found = lookUp(answer[0], j);
      if (found.length < 2) continue;
      items.push(
        [
          `Item ${s.id}#${w.n}: ${w.pointed}, named ${answer[0]} "${answer[1]}"`,
          `  In: ${s.words.map((x) => (x.n === w.n ? `[${x.pointed}]` : x.pointed)).join(' ')}`,
          ...found.map((h, k) => `  ${k + 1}. ${h}: ${j.gloss.get(h) ?? ''}`),
        ].join('\n'),
      );
    }
  }
  const head = [
    'You are reading words of the Babylonian Talmud (Hebrew and Aramaic, vowelled), each shown',
    'in its passage with the word in [brackets], the dictionary form and gloss a reader gave it,',
    "and the entries of Jastrow's dictionary under that form. Choose the entry the word is an",
    'instance of here. Answer 0 if none fits.',
    '',
    'Answer as one JSON object: item name → entry number, for example',
    '{"Berakhot 2a:1#3": 2}. Answer every item.',
    '',
  ];
  const per = Math.ceil(items.length / Math.ceil(items.length / 250));
  for (let b = 0; b * per < items.length; b++) {
    const name = String(b + 1).padStart(2, '0');
    writeFileSync(
      join(folder, `choose-${name}.md`),
      [head.join('\n'), ...items.slice(b * per, (b + 1) * per)].join('\n\n'),
    );
  }
  console.log(
    `${items.length} named forms with several entries, in ${Math.ceil(items.length / per)} batches.`,
  );
}

// ---------------------------------------------------------------------------

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');

function score(folder: string) {
  const j = loadJastrow(DEFAULT_DUMP);
  const { pointed } = loadForms(DEFAULT_DUMP);
  loadEntries(DEFAULT_DUMP, pointed);
  const segments = segmentsOf(folder);
  const chosen = readAnswers<number>(folder, 'with-list-');
  const named = readAnswers<[string, string]>(folder, 'without-list-');
  const second: Record<string, number> = {};
  for (const f of readdirSync(folder).filter((f) => f.startsWith('choose-') && f.endsWith('.json')))
    Object.assign(second, JSON.parse(readFileSync(join(folder, f), 'utf8')));

  /** The entry the version without the list reaches, or why it reaches none. */
  const withoutList = (s: Segment, w: Word): string => {
    const answer = named[s.id]?.[w.n];
    if (!answer) return 'no answer';
    const found = lookUp(answer[0], j);
    if (found.length === 0) return 'not a headword';
    if (found.length === 1) return found[0];
    const k = second[`${s.id}#${w.n}`];
    return k ? (found[k - 1] ?? 'no answer') : k === 0 ? 'none fits' : 'no answer';
  };
  const withList = (s: Segment, w: Word): string => {
    if (w.heads.length === 1) return w.heads[0];
    const k = chosen[s.id]?.[w.n];
    return k ? (w.heads[k - 1] ?? 'no answer') : k === 0 ? 'none fits' : 'no answer';
  };
  /** Sefaria's pick, else the one headword whose spellings carry the word's vowels. */
  const rules = (w: Word): string => {
    if (w.heads.length === 1) return w.heads[0];
    if (w.pick.length === 1) return w.pick[0];
    const v = vowelMatches(w.heads, pointedFold(w.pointed), pointed);
    return v.length === 1 ? v[0] : 'undecided';
  };

  const all = segments.flatMap((s) => s.words.map((w) => ({ s, w })));
  const report = (title: string, set: typeof all) => {
    console.log(`\n## ${title}: ${set.length} occurrences`);
    console.log('| | right | wrong, same letters as the right entry | wrong, other | other |');
    console.log('|---|---|---|---|---|');
    for (const [name, f] of [
      ['Rules (Sefaria pick, then vowels)', ({ w }: (typeof all)[0]) => rules(w)],
      ['Model with the word list', ({ s, w }: (typeof all)[0]) => withList(s, w)],
      ['Model without the word list', ({ s, w }: (typeof all)[0]) => withoutList(s, w)],
    ] as const) {
      const got = set.map((x) => ({ x, a: f(x) }));
      const right = got.filter(({ x, a }) => a === x.w.truth).length;
      const other = new Map<string, number>();
      for (const { a } of got)
        if (['undecided', 'no answer', 'none fits', 'not a headword'].includes(a))
          other.set(a, (other.get(a) ?? 0) + 1);
      const others = [...other].reduce((t, [, n]) => t + n, 0);
      const twin = got.filter(
        ({ x, a }) =>
          a !== x.w.truth &&
          !other.has(a) &&
          fold(bareHeadword(a)) === fold(bareHeadword(x.w.truth!)),
      ).length;
      console.log(
        `| ${name} | ${pct(right, set.length)} | ${pct(twin, set.length)} | ${pct(set.length - right - twin - others, set.length)} | ${[...other].map(([k, n]) => `${k} ${pct(n, set.length)}`).join(', ') || '—'} |`,
      );
    }
  };
  const quoted = all.filter(({ w }) => w.truth);
  report(
    'Quoted occurrences with several headwords in the list',
    quoted.filter(({ w }) => w.heads.length > 1),
  );
  report('All quoted occurrences', quoted);

  const listed = all.filter(({ w }) => w.heads.length > 0);
  const agree = listed.filter(({ s, w }) => withList(s, w) === withoutList(s, w)).length;
  console.log(
    `\nThe two versions agree on ${pct(agree, listed.length)} of ${listed.length} words the list has.`,
  );
  const unlisted = all.filter(({ w }) => w.heads.length === 0);
  const reached = unlisted.filter(({ s, w }) => {
    const a = withoutList(s, w);
    return !['no answer', 'none fits', 'not a headword'].includes(a);
  }).length;
  console.log(
    `Words the list lacks: ${unlisted.length} of ${all.length} (${pct(unlisted.length, all.length)}); the version without it reaches an entry for ${pct(reached, unlisted.length)}.`,
  );
  const missed = new Map<string, number>();
  for (const { s, w } of all) {
    const a = named[s.id]?.[w.n];
    if (a && lookUp(a[0], j).length === 0) missed.set(a[0], (missed.get(a[0]) ?? 0) + 1);
  }
  console.log(
    `Named forms that are no headword, commonest: ${[...missed]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([f, n]) => `${f} ${n}`)
      .join(' · ')}`,
  );
  console.log('\nWrong answers on quoted occurrences (word: truth | with list | without):');
  for (const { s, w } of quoted.filter(({ w }) => w.heads.length > 1).slice(0, 400)) {
    const a = withList(s, w);
    const b = withoutList(s, w);
    if (a !== w.truth || b !== w.truth)
      console.log(
        `- ${s.id} ${w.pointed}: ${w.truth} | ${a} | ${b} (${named[s.id]?.[w.n]?.join(' "') ?? ''}")`,
      );
  }
}

// ---------------------------------------------------------------------------

const SHEET = 100;

/**
 * For reading by eye: every word of the segments with the entry each version reaches, how
 * often the word's spelling occurs in the Talmud, and a sheet of words drawn at random.
 */
function read(folder: string) {
  const j = loadJastrow(DEFAULT_DUMP);
  const segments = segmentsOf(folder);
  const chosen = readAnswers<number>(folder, 'with-list-');
  const named = readAnswers<[string, string]>(folder, 'without-list-');
  const second: Record<string, number> = {};
  for (const f of readdirSync(folder).filter((f) => f.startsWith('choose-') && f.endsWith('.json')))
    Object.assign(second, JSON.parse(readFileSync(join(folder, f), 'utf8')));
  const count = new Map<string, number>();
  for (const tok of tokens()) {
    const k = pointedFold(tok.pointed ?? tok.written);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const entry = (h: string | undefined) => (h ? `${h}: ${j.gloss.get(h) ?? ''}` : '—');
  const rows = segments.flatMap((s) =>
    s.words.map((w) => {
      const k = chosen[s.id]?.[w.n];
      const withList =
        w.heads.length === 0
          ? 'not in the list'
          : w.heads.length === 1
            ? entry(w.heads[0])
            : k
              ? entry(w.heads[k - 1])
              : 'none fits';
      const answer = named[s.id]?.[w.n];
      const found = answer ? lookUp(answer[0], j) : [];
      const pick = found.length === 1 ? found[0] : found[(second[`${s.id}#${w.n}`] ?? 0) - 1];
      const without = !answer
        ? 'no answer'
        : `${answer[0]} "${answer[1]}" → ${found.length === 0 ? 'no such headword' : entry(pick)}`;
      const label = pick
        ? `**${pick}**: ${(j.gloss.get(pick) ?? '').slice(0, 90)}`
        : `none (the model named ${answer?.[0] ?? 'nothing'}, which finds no headword)`;
      return { s, w, count: count.get(pointedFold(w.pointed)) ?? 0, withList, without, label };
    }),
  );
  const cell = (t: string) => t.replace(/\|/g, '/');
  const passages = segments.flatMap((s) => [
    `## ${s.id}`,
    '',
    s.words.map((w) => w.pointed).join(' '),
    '',
    '| # | word | times in the Talmud | with the list | without the list |',
    '|---|---|---|---|---|',
    ...rows
      .filter((r) => r.s === s)
      .map(
        (r) =>
          `| ${r.w.n} | ${r.w.pointed} | ${r.count} | ${cell(r.withList)} | ${cell(r.without)} |`,
      ),
    '',
  ]);
  writeFileSync(join(folder, 'passages.md'), passages.join('\n'));

  const random = mulberry32(SEED + 1);
  const drawn = [...rows];
  for (let i = drawn.length - 1; i > 0; i--) {
    const k = Math.floor(random() * (i + 1));
    [drawn[i], drawn[k]] = [drawn[k], drawn[i]];
  }
  const sheet = drawn
    .slice(0, SHEET)
    .flatMap((r, i) => [
      `### ${i + 1}. ${r.w.pointed} (${r.s.id}, word ${r.w.n})`,
      '',
      r.s.words.map((w) => (w === r.w ? `**[${w.pointed}]**` : w.pointed)).join(' '),
      '',
      `- Filed under: ${r.label}`,
      '- Right meaning? yes / no / unsure',
      '',
    ]);
  writeFileSync(join(folder, 'sheet.md'), sheet.join('\n'));
  console.log(`${rows.length} words in ${segments.length} segments; sheet of ${SHEET}.`);
}

const [command, folder, phrase] = process.argv.slice(2);
if (!folder)
  throw new Error('Usage: model-pilot.ts prepare|prepare-whole|lookup|score|read <folder>');
if (!command.startsWith('prepare') && !existsSync(join(folder, 'segments.json')))
  throw new Error(`No segments.json in ${folder}; run prepare first.`);
const commands: Record<string, (folder: string) => void> = {
  prepare: (f) => prepare(f, false),
  'prepare-whole': (f) => prepare(f, true, phrase),
  lookup,
  score,
  read,
};
if (!commands[command]) throw new Error(`Unknown command ${command}`);
commands[command](folder);
