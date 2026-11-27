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
  spellingVariants,
  tokens,
  vowelMatches,
} from './word-forms.ts';

const SEGMENTS = 200;
const WHOLE_SEGMENTS = 40;
const PER_BATCH = 20;
const SEED = 411;
const GLOSS_WORDS = 14;

/**
 * The commonest small words, which the search leaves out: pronouns, prepositions, negations,
 * conjunctions and other particles found 1,000 times or more, as written, prefixes and all.
 * The model is not asked about them; they stay in the passage it reads.
 */
const SMALL_WORDS = new Set(
  (
    'לא ליה אלא על את מאי הוא אין ולא לו כל לה של נמי הא אי אבל כי זה מה עד הכי או היא ' +
    'שלא לי מן דלא להו קא בין לאו לך בו בה מי אינו שאין והא הכא הרי ואין עליו לן התם זו ' +
    'ואי האי כאן יש ביה כך וכי אשר אתה אני להם למה אותו בהן הן הני ההוא שהוא וכל אלו מאן ' +
    'מינה מיניה דאי היינו הכל וכן שיש להן בכל ועל במאי ומה אינה שאינו'
  )
    .split(' ')
    .map(fold),
);
const asked = (w: Word) => !SMALL_WORDS.has(fold(w.pointed));

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

/**
 * Forms Jastrow files where neither the lookup nor the short gloss would lead: בָּרוּךְ "blessed"
 * under the verb, the headword בָּרוּךְ being the neck of an animal; מִשּׁוּם "because of" deep
 * inside שׁוּם II.
 */
const FILED_UNDER = new Map(
  [
    ['בָּרוּךְ', 'בָּרַךְ'],
    ['מִשּׁוּם', 'שׁוּם II'],
  ].map(([form, h]) => [pointedFold(form), h]),
);

/** A folded vowelled form spelled with ו for its holam and qubuts, as Jastrow spells חוֹמֶר. */
const fullSpelling = (folded: string) =>
  folded.replace(/([א-ת][ׁׂ]?)ֹ/g, (m, l: string) => (l === 'ו' ? m : `${l}וֹ`)).replace(/ֻ/g, 'ו');

/**
 * Roots a form may be filed under: a causative verb without its ה and י (הֵבִיא → בוא,
 * הוֹלִיד → ילד) and a passive participle without its ו (בְּעוּלָה → בעל).
 */
function roots(letters: string): string[] {
  const out: string[] = [];
  if (letters.length >= 4 && letters[0] === 'ה') {
    let r = letters.slice(1);
    if (r.at(-2) === 'י') r = r.slice(0, -2) + r.at(-1);
    if (r.length === 2) out.push(`${r[0]}ו${r[1]}`);
    if (r[0] === 'ו') out.push(`י${r.slice(1)}`);
    out.push(r);
  }
  const stem = letters.length >= 5 && letters.endsWith('ה') ? letters.slice(0, -1) : letters;
  if (stem.length >= 4 && stem.at(-2) === 'ו') out.push(stem.slice(0, -2) + stem.at(-1));
  return out;
}

/**
 * The headwords a named dictionary form can be: by its vowels, as written or in full spelling,
 * else by its letters; when none finds one, by the form one ו or י away, by its root, and
 * last with its prefix letters off, the first that finds any. What those find is a guess, for
 * the model to confirm or turn down.
 */
function lookUp(
  form: string,
  j: ReturnType<typeof loadJastrow>,
): { entries: string[]; guessed: boolean } {
  const filed = FILED_UNDER.get(pointedFold(form));
  if (filed) return { entries: [filed], guessed: false };
  const letters = fold(form);
  const tries: [Map<string, Set<string>>, string][] = [
    [j.byPointed, pointedFold(form)],
    [j.byPointed, fullSpelling(pointedFold(form))],
    [j.byLetters, letters],
    ...[...spellingVariants(letters), ...roots(letters), ...readings(letters).slice(1)].map(
      (l) => [j.byLetters, l] as [Map<string, Set<string>>, string],
    ),
  ];
  for (const [i, [map, key]] of tries.entries()) {
    const found = map.get(key);
    if (found?.size) return { entries: [...found], guessed: i > 2 };
  }
  return { entries: [], guessed: false };
}

/** Whether the model is asked to choose among, or confirm, what the lookup found. */
const toChoose = (found: ReturnType<typeof lookUp>) =>
  found.entries.length > 1 || (found.guessed && found.entries.length > 0);

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
    for (const w of s.words.filter((w) => w.heads.length > 1 && asked(w))) {
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
    'Answer for the words listed after Words, by their numbers.',
    '',
    'Answer as one JSON object: segment name → word number → [dictionary form, gloss], for',
    'example {"Berakhot 2a:1": {"1": ["מֵאֵימָתַי", "from when"], "2": ["קָרָא", "to read"]}}.',
    'Answer every word listed.',
    '',
  ];
  for (const s of batch) {
    out.push(
      context(s),
      `Words: ${s.words
        .filter(asked)
        .map((w) => `${w.n} ${w.pointed}`)
        .join(' · ')}`,
      '',
    );
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

/**
 * The second round's answers, each as the entry chosen (null for none) among the entries it was
 * asked about, read back from the batch it was asked in.
 */
function choices(folder: string): Map<string, { among: string[]; entry: string | null }> {
  const out = new Map<string, { among: string[]; entry: string | null }>();
  for (const f of readdirSync(folder).filter((f) => /^choose-\d+\.json$/.test(f))) {
    const answers: Record<string, number> = JSON.parse(readFileSync(join(folder, f), 'utf8'));
    const asked = readFileSync(join(folder, f.replace('.json', '.md')), 'utf8');
    for (const item of asked.split(/^Item /m).slice(1)) {
      const name = item.slice(0, item.indexOf(': '));
      const among = [...item.matchAll(/^ {2}\d+\. (.+?): /gm)].map(([, h]) => h);
      const k = answers[name];
      if (k !== undefined) out.set(name, { among, entry: k ? (among[k - 1] ?? null) : null });
    }
  }
  return out;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The second round's answer for an item, if it was asked about the entries now found. */
function choice(chosen: ReturnType<typeof choices>, item: string, found: string[]) {
  const c = chosen.get(item);
  return c && same(c.among, found) ? c : undefined;
}

/** The entry the version without the list reaches for a word, or why it reaches none. */
function reach(
  item: string,
  form: string | undefined,
  j: ReturnType<typeof loadJastrow>,
  second: ReturnType<typeof choices>,
): string {
  if (!form) return 'no answer';
  const found = lookUp(form, j);
  if (found.entries.length === 0) return 'not a headword';
  if (!toChoose(found)) return found.entries[0];
  const c = choice(second, item, found.entries);
  return c ? (c.entry ?? 'none fits') : 'no answer';
}

/** The second batches: the named forms with several entries not yet answered among them. */
function lookup(folder: string) {
  const j = loadJastrow(DEFAULT_DUMP);
  const named = readAnswers<[string, string]>(folder, 'without-list-');
  const chosen = choices(folder);
  const items: string[] = [];
  const segments = segmentsOf(folder);
  for (const s of segments) {
    for (const w of s.words) {
      const answer = named[s.id]?.[w.n];
      if (!answer) continue;
      const found = lookUp(answer[0], j);
      if (!toChoose(found) || choice(chosen, `${s.id}#${w.n}`, found.entries)) continue;
      items.push(
        [
          `Item ${s.id}#${w.n}: ${w.pointed}, named ${answer[0]} "${answer[1]}"`,
          `  In: ${s.words.map((x) => (x.n === w.n ? `[${x.pointed}]` : x.pointed)).join(' ')}`,
          ...found.entries.map((h, k) => `  ${k + 1}. ${h}: ${j.gloss.get(h) ?? ''}`),
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
  const first = readdirSync(folder).filter((f) => /^choose-\d+\.md$/.test(f)).length + 1;
  const batches = Math.ceil(items.length / 250);
  const per = Math.ceil(items.length / Math.max(batches, 1));
  for (let b = 0; b < batches; b++) {
    const name = String(first + b).padStart(2, '0');
    writeFileSync(
      join(folder, `choose-${name}.md`),
      [head.join('\n'), ...items.slice(b * per, (b + 1) * per)].join('\n\n'),
    );
  }
  console.log(
    `${items.length} named forms with several entries to choose among, in ${batches} batches.`,
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
  const second = choices(folder);

  const withoutList = (s: Segment, w: Word) =>
    reach(`${s.id}#${w.n}`, named[s.id]?.[w.n]?.[0], j, second);
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
    if (a && withoutList(s, w) === 'not a headword') missed.set(a[0], (missed.get(a[0]) ?? 0) + 1);
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
  const second = choices(folder);
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
      const reached = reach(`${s.id}#${w.n}`, answer?.[0], j, second);
      const pick = j.gloss.has(reached) ? reached : undefined;
      const without = !answer
        ? 'no answer'
        : `${answer[0]} "${answer[1]}" → ${pick ? entry(pick) : reached}`;
      const label = pick
        ? `**${pick}**: ${(j.gloss.get(pick) ?? '').slice(0, 90)}`
        : `none (the model named ${answer?.[0] ?? 'nothing'}: ${reached})`;
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
