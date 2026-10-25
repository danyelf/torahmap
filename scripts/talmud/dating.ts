#!/usr/bin/env tsx
// Build public/data/talmud/dating.json and rabbis.json from the facts sefaria-dating-facts.py
// reads out of Sefaria's database dump:
//
//   uv run scripts/talmud/sefaria-dating-facts.py <dump dir> <facts.json>
//   node scripts/talmud/dating.ts <facts.json>

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DatedSegment, Generation, Person, TalmudDating } from '@torahmap/talmud/dating.ts';
import { DATING_FILE } from '@torahmap/talmud/dating.ts';
import {
  STRUCTURE_FILE,
  textsFile,
  type TalmudStructure,
  type TalmudTractateText,
} from '@torahmap/talmud/data.ts';
import { talmudId } from '@torahmap/talmud/layout.ts';
import { RABBIS_FILE } from '@torahmap/talmud/rabbis.ts';
import { rabbisFrom } from './rabbis.ts';
import { isAmbiguous, latestGeneration, type Facts, type Mention } from './facts.ts';

/** The edition the map shows, whose character positions the tags use. */
const EDITION = 'William Davidson Edition - Aramaic';

const REF = /^(.+) (\d+)([ab]):(\d+)(.*)$/;
/** How far from its tagged position a name may be found in the map's own text. */
const NEARBY = 150;

/** How the tagged names were found in the map's text. */
export interface Placement {
  exact: number;
  nearby: number;
  dropped: number;
}

const escapeWord = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A word as the map's text may spell it: the dump writes "רבי" and "רב" where the map abbreviates. */
function spellings(word: string): string {
  const title = /^([בכלמשוהד]{0,3})(רבי|רב)$/.exec(word);
  if (!title) return escapeWord(word);
  const [, , full] = title;
  const abbreviations = full === 'רבי' ? `|ר['׳]` : '';
  return `[בכלמשוהד]{0,3}(?:${full}${abbreviations}|(?<=א")ר)`;
}

/** Vowel points, accents and the like: the tags count the text without them, the map shows it with. */
const MARKS = /[֑-ׇֽֿׁׂׅׄ]/;

/** Where `mention`'s words stand in `line`, which may be vowelled: at its tagged position, else the nearest spelling of them within NEARBY. */
export function placeIn(
  line: string,
  mention: Mention,
): { start: number; end: number; exact: boolean } | null {
  const origin: number[] = [];
  let bare = '';
  for (let i = 0; i < line.length; i++) {
    if (MARKS.test(line[i])) continue;
    origin.push(i);
    bare += line[i];
  }
  const found = placeInBare(bare, mention);
  if (!found) return null;
  // The end takes the marks that follow its last letter.
  let end = origin[found.end - 1] + 1;
  while (end < line.length && MARKS.test(line[end])) end++;
  return { start: origin[found.start], end, exact: found.exact };
}

function placeInBare(
  line: string,
  { start, end, text }: Mention,
): { start: number; end: number; exact: boolean } | null {
  if (start === null || end === null || !text) return null;
  if (line.slice(start, end) === text) return { start, end, exact: true };
  const pattern = new RegExp(
    `(?<![א-ת])${text.split(/\s+/).map(spellings).join('\\s+')}(?![א-ת])`,
    'g',
  );
  return (
    [...line.matchAll(pattern)]
      .map((m) => ({ start: m.index, end: m.index + m[0].length, exact: false }))
      .filter((m) => Math.abs(m.start - start) <= NEARBY)
      .sort((a, b) => Math.abs(a.start - start) - Math.abs(b.start - start))[0] ?? null
  );
}

/**
 * `texts` is each tractate's lines as the map shows them, laid out as its files' `amudim`.
 * `placement` counts what became of each tag that dates a segment.
 */
export function datingFrom(
  facts: Facts,
  structure: TalmudStructure,
  texts: ReadonlyMap<string, readonly (readonly string[])[]>,
  placement: Placement = { exact: 0, nearby: 0, dropped: 0 },
): TalmudDating {
  const { periods, topics, candidates } = facts;

  const latestOf = (code: string | null | undefined) => latestGeneration(code, periods);

  const generationOf = (slug: string): string | null =>
    isAmbiguous(slug)
      ? ((candidates[slug] ?? [])
          .map((c) => latestOf(topics[c]?.generation))
          .filter((c): c is string => c !== null)
          .sort((a, b) => periods[b].from - periods[a].from)[0] ?? null)
      : latestOf(topics[slug]?.generation);

  const tractates = new Map(structure.tractates.map((t) => [t.name, t]));
  const byId = new Map<string, Mention[]>();
  for (const m of facts.mentions) {
    if (m.language !== 'he' || m.version !== EDITION) continue;
    if (m.start === null || m.end === null) throw new Error(`${m.ref} has a tag with no position`);
    const match = REF.exec(m.ref);
    if (!match) continue;
    const [, name, daf, amud, segment, rest] = match;
    const tractate = tractates.get(name);
    if (!tractate) continue;
    if (rest) throw new Error(`${m.ref} is a range; mentions must name one segment`);
    const place = tractate.amudim.find((a) => a.daf === Number(daf) && a.amud === amud);
    if (!place || Number(segment) < 1 || Number(segment) > place.segmentCount) {
      throw new Error(`${m.ref} is not a segment of the map`);
    }
    const id = talmudId({
      tractate: name,
      daf: Number(daf),
      amud: amud as 'a' | 'b',
      segment: Number(segment),
    });
    byId.set(id, [...(byId.get(id) ?? []), m]);
  }

  /** Each segment: its latest generation code, whether that is uncertain, and the topics to list. */
  const found = new Map<
    string,
    { code: string; uncertain: boolean; slugs: string[]; shown: Mention[] }
  >();
  for (const [id, mentions] of byId) {
    const dated = mentions.filter((m) => !isAmbiguous(m.topic) && generationOf(m.topic));
    const ambiguous = mentions.filter((m) => isAmbiguous(m.topic) && generationOf(m.topic));
    const uncertain = dated.length === 0;
    // Only resolved names date a passage that has any; its ambiguous names are listed, not counted.
    const pool = uncertain ? ambiguous : dated;
    if (pool.length === 0) continue;
    const code = pool
      .map((m) => generationOf(m.topic)!)
      .sort((a, b) => periods[b].from - periods[a].from)[0];
    const listed = [...dated, ...ambiguous];
    // A title tagged as its own person inside a fuller name stays out of the list.
    const inside = (m: Mention) =>
      listed.some(
        (o) =>
          o !== m &&
          o.topic !== m.topic &&
          o.start! <= m.start! &&
          m.end! <= o.end! &&
          o.end! - o.start! > m.end! - m.start!,
      );
    const shown = listed.filter((m) => !inside(m)).sort((a, b) => a.start! - b.start!);
    const slugs = [...new Set(shown.map((m) => m.topic))];
    found.set(id, { code, uncertain, slugs, shown });
  }

  const slugs = [...new Set([...found.values()].flatMap((f) => f.slugs))].sort();

  // A listed rabbi's generation is in the list even when no segment's latest is that one.
  const codes = [
    ...new Set(
      [...found.values()].map((f) => f.code).concat(slugs.map((slug) => generationOf(slug)!)),
    ),
  ].sort((a, b) => periods[a].from - periods[b].from);
  const generations: Generation[] = codes.map((code) => ({
    code,
    from: periods[code].from,
    to: periods[code].to,
  }));
  const placeOfCode = new Map(codes.map((c, i) => [c, i]));

  const people: Person[] = slugs.map((slug) => ({
    id: slug,
    en: topics[slug].en ?? slug,
    he: topics[slug].he ?? '',
    gen: placeOfCode.get(generationOf(slug)!)!,
    ...(isAmbiguous(slug) ? { ambiguous: true as const } : {}),
  }));
  const placeOfSlug = new Map(slugs.map((s, i) => [s, i]));

  const segments: Record<string, DatedSegment> = {};
  for (const tractate of structure.tractates) {
    for (const amud of tractate.amudim) {
      for (let segment = 1; segment <= amud.segmentCount; segment++) {
        const id = talmudId({ tractate: tractate.name, daf: amud.daf, amud: amud.amud, segment });
        const f = found.get(id);
        if (f) {
          const amudPlace = tractate.amudim.indexOf(amud);
          const line = texts.get(tractate.name)?.[amudPlace]?.[segment - 1] ?? '';
          const spans: number[] = [];
          for (const m of f.shown) {
            const at = placeIn(line, m);
            // Two tags cannot mark one stretch of the line.
            const taken =
              at && spans.some((s, i) => i % 3 === 0 && s < at.end && at.start < spans[i + 1]);
            if (!at || taken) {
              placement.dropped++;
            } else {
              placement[at.exact ? 'exact' : 'nearby']++;
              spans.push(at.start, at.end, placeOfSlug.get(m.topic)!);
            }
          }
          segments[id] = [
            placeOfCode.get(f.code)!,
            f.uncertain ? 1 : 0,
            f.slugs.map((s) => placeOfSlug.get(s)!),
            spans,
          ];
        }
      }
    }
  }
  return { generations, people, segments };
}

async function main() {
  const factsPath = process.argv[2];
  if (!factsPath) throw new Error('usage: node scripts/talmud/dating.ts <facts.json>');
  const dataDir = join(import.meta.dirname, '../../public/data');
  const facts = JSON.parse(await readFile(factsPath, 'utf-8')) as Facts;
  const structure = JSON.parse(
    await readFile(join(dataDir, STRUCTURE_FILE), 'utf-8'),
  ) as TalmudStructure;
  const texts = new Map(
    await Promise.all(
      structure.tractates.map(async (t) => {
        const file = JSON.parse(await readFile(join(dataDir, textsFile(t.name)), 'utf-8'));
        return [t.name, (file as TalmudTractateText).amudim] as const;
      }),
    ),
  );
  const placement = { exact: 0, nearby: 0, dropped: 0 };
  const dating = datingFrom(facts, structure, texts, placement);
  await writeFile(join(dataDir, DATING_FILE), JSON.stringify(dating), 'utf-8');
  const rabbis = rabbisFrom(facts, dating);
  await writeFile(join(dataDir, RABBIS_FILE), JSON.stringify(rabbis), 'utf-8');

  const uncertain = Object.values(dating.segments).filter((s) => s[1] === 1).length;
  console.log(`${Object.keys(dating.segments).length} segments dated, ${uncertain} uncertain`);
  console.log(
    `names marked in the text: ${placement.exact} exactly, ${placement.nearby} nearby, ${placement.dropped} not found or overlapping`,
  );
  console.log(`${rabbis.rabbis.length} rabbis to pick`);
  for (const g of dating.generations) console.log(`  ${g.code} ${g.from} to ${g.to}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('dating failed:', err);
    process.exit(1);
  });
}
