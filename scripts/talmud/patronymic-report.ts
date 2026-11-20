// Counts the "X bar Y" names Sefaria tags in the Aramaic edition as two people, or as the first
// half only. Run from the repo root:
//   node scripts/talmud/patronymic-report.ts <facts.json> <all-topics.json> <report.json>
// facts.json is from sefaria-dating-facts.py, all-topics.json from sefaria-all-names.py.
// The report holds the split pairs and the cut-short tags; the counts print.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TalmudStructure, TalmudTractateText } from '@torahmap/talmud/data.ts';
import { EDITION, placeIn } from './dating.ts';
import type { Facts, Mention } from './facts.ts';

const [factsPath, allTopicsPath, outPath] = process.argv.slice(2);
if (!factsPath || !allTopicsPath || !outPath) {
  throw new Error('usage: patronymic-report.ts <facts.json> <all-topics.json> <report.json>');
}
const facts: Facts = JSON.parse(await readFile(factsPath, 'utf-8'));
const data = 'public/data/talmud';
const structure: TalmudStructure = JSON.parse(
  await readFile(join(data, 'structure.json'), 'utf-8'),
);

interface AnyTopic {
  en: string | null;
  generation: string | null;
  era: string | null;
  names: string[];
}
const allTopics: Record<string, AnyTopic> = JSON.parse(await readFile(allTopicsPath, 'utf-8'));

const MARKS = /[֑-ׇ]/g;
const bare = (s: string) => s.replace(MARKS, '').replace(/[״]/g, '"').replace(/[׳]/g, "'");
const TITLE = new Set(['רב', 'רבי', "ר'", 'מר']);
const LINK = /^(בר|בן|בריה ד|ברבי|ברה ד|בריה דר|בת)$/;
/** A name as words without titles, with every patronymic word as "בר". */
const key = (name: string) =>
  bare(name)
    .replace(/[?.,:;]/g, '')
    .replace(/בריה ד/g, 'בר ')
    .split(/\s+/)
    .filter((w) => w && !TITLE.has(w))
    .map((w) => (/^(בר|בן|ברבי|בת)$/.test(w) ? 'בר' : w))
    .join(' ');

const byName = new Map<string, Set<string>>();
for (const [slug, t] of Object.entries(allTopics)) {
  for (const n of t.names) {
    if (!/[א-ת]/.test(n)) continue;
    const k = key(n);
    if (!k.includes(' בר ')) continue;
    byName.set(k, (byName.get(k) ?? new Set()).add(slug));
  }
}

const REF = /^(.+) (\d+)([ab]):(\d+)$/;
const segs = new Map<string, Mention[]>();
for (const m of facts.mentions) {
  if (m.language !== 'he' || m.version !== EDITION) continue;
  if (!REF.test(m.ref)) continue;
  segs.set(m.ref, [...(segs.get(m.ref) ?? []), m]);
}

const texts = new Map<string, string[][]>();
const lineOf = async (ref: string): Promise<string | null> => {
  const [, name, daf, amud, seg] = REF.exec(ref)!;
  const tr = structure.tractates.find((t) => t.name === name);
  if (!tr) return null;
  if (!texts.has(name)) {
    const text: TalmudTractateText = JSON.parse(
      await readFile(join(data, 'texts', `${name}.json`), 'utf-8'),
    );
    texts.set(name, text.amudim);
  }
  const i = tr.amudim.findIndex((a) => a.daf === Number(daf) && a.amud === amud);
  return texts.get(name)![i]?.[Number(seg) - 1] ?? null;
};

interface Split {
  ref: string;
  first: string;
  second: string;
  text: string;
  joinedAs: string[];
}
interface CutShort {
  ref: string;
  topic: string;
  text: string;
}
const splits: Split[] = [];
/** A tag followed by "bar Y" that no tag covers: the first half of a name tagged as the whole person. */
const cutShort: CutShort[] = [];
let placedFail = 0;
for (const [ref, ms] of segs) {
  const line = await lineOf(ref);
  if (!line) continue;
  const placed = ms
    .map((m) => ({ m, at: placeIn(line, m) }))
    .flatMap((p) => (p.at ? [{ m: p.m, at: p.at }] : (placedFail++, [])))
    .sort((a, b) => a.at.start - b.at.start);
  for (const p of placed) {
    const after = bare(line.slice(p.at.end, p.at.end + 40));
    const next = placed.find((q) => q.at.start >= p.at.end && q.at.start <= p.at.end + 12);
    const m = /^\s+(בר|בן|בריה)\s+(\S+(?:\s+\S+)?)/.exec(after);
    if (m && !next) {
      cutShort.push({
        ref: p.m.ref,
        topic: p.m.topic,
        text: bare(line.slice(p.at.start, p.at.end)) + ' ' + m[1] + ' ' + m[2],
      });
    }
  }
  for (let i = 0; i + 1 < placed.length; i++) {
    const a = placed[i];
    const b = placed[i + 1];
    if (b.at.start < a.at.end) continue;
    const gap = bare(line.slice(a.at.end, b.at.start)).trim().replace(/\s+/g, ' ');
    if (!LINK.test(gap)) continue;
    const joined = key(`${a.m.text} בר ${b.m.text}`);
    splits.push({
      ref,
      first: a.m.topic,
      second: b.m.topic,
      text: bare(line.slice(a.at.start, b.at.end)),
      joinedAs: [...(byName.get(joined) ?? [])],
    });
  }
}

// Tags that already name a whole "X bar Y" person, for comparison.
const whole = new Map<string, number>();
for (const ms of segs.values())
  for (const m of ms)
    if (/ (בר|בן|בריה|ברבי) /.test(` ${bare(m.text ?? '')} `))
      whole.set(m.topic, (whole.get(m.topic) ?? 0) + 1);

const joinable = splits.filter((s) => s.joinedAs.length > 0);
const byPerson = new Map<string, { split: number; whole: number }>();
for (const s of joinable) {
  const p = s.joinedAs.join('|');
  const e = byPerson.get(p) ?? {
    split: 0,
    whole: s.joinedAs.reduce((n, j) => n + (whole.get(j) ?? 0), 0),
  };
  e.split++;
  byPerson.set(p, e);
}
const summary = {
  segmentsWithTags: segs.size,
  notPlaced: placedFail,
  splitPairs: splits.length,
  splitSegments: new Set(splits.map((s) => s.ref)).size,
  joinableToKnownPerson: joinable.length,
  joinableAmbiguous: joinable.filter((s) => s.joinedAs.length > 1).length,
  wholeNameTags: [...whole.values()].reduce((a, b) => a + b, 0),
  people: [...byPerson]
    .sort((a, b) => b[1].split - a[1].split)
    .map(([p, e]) => ({ person: p, ...e })),
};
await writeFile(outPath, JSON.stringify({ summary, splits, cutShort }, null, 1));
console.log('cut short:', cutShort.length);
console.log(JSON.stringify({ ...summary, people: summary.people.slice(0, 25) }, null, 1));

// Which cut-short tags name a person whose own name already carries that patronymic (no error).
const namesOf = (slug: string): string[] =>
  [slug, ...(facts.candidates[slug] ?? [])].flatMap((s) => (allTopics[s]?.names ?? []).map(key));
const datedSlug = (slug: string) =>
  [slug, ...(facts.candidates[slug] ?? [])].some((s) => allTopics[s]?.generation);
let ok = 0;
const wrong: CutShort[] = [];
for (const c of cutShort) {
  const k = key(c.text.replace(/[,:.–]/g, ' '));
  if (namesOf(c.topic).some((n) => n.includes(' בר ') && k.startsWith(n))) ok++;
  else wrong.push(c);
}
const wrongDated = wrong.filter((c) => datedSlug(c.topic));
console.log(
  'cut short, name matches person:',
  ok,
  ' not matching:',
  wrong.length,
  ' of which dated sages:',
  wrongDated.length,
  'segments',
  new Set(wrongDated.map((c) => c.ref)).size,
);
await writeFile(
  outPath.replace('.json', '-cutshort-wrong.json'),
  JSON.stringify(wrongDated, null, 1),
);

// For the wrong cut-short tags: is there a Sefaria person whose name is the full "X bar Y"?
const allKeys = [...byName.keys()];
let found = 0;
const missing = new Map<string, number>();
for (const c of wrongDated) {
  const k = key(c.text.replace(/[,:.–]/g, ' '));
  const hit = allKeys.filter((n) => k === n || k.startsWith(n + ' '));
  if (hit.length) found++;
  else {
    const two = k.split(' ').slice(0, 3).join(' ');
    missing.set(two, (missing.get(two) ?? 0) + 1);
  }
}
console.log(
  'wrong cut-short with a Sefaria person for the full name:',
  found,
  ' without:',
  wrongDated.length - found,
);
console.log(
  [...missing]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, n]) => `${n} ${k}`)
    .join('\n'),
);
